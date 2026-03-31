import json
import math
import os
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import load_backend_env
from app.database.db import load_conversation_log_db, save_dispatcher_log_db, save_judge_result_db
from app.llm import chat_completion_with_fallback

router = APIRouter()
load_backend_env()

VALID_DIMENSIONS = ["know_understand", "use_apply", "evaluate_create", "ethics"]


class AnalyzeRequest(BaseModel):
    session_id: str
    logs: Optional[List[Dict[str, Any]]] = None


class TurnAttribution(BaseModel):
    turn_index: int
    role: str
    content: str
    dimension: str
    confidence: Optional[float] = None
    reason: str


class TrajectoryFeatures(BaseModel):
    dimension_diversity: float
    jump_density: float
    ethics_reached: bool
    longest_stay_dimension: str
    longest_stay_rounds: int
    pattern: str


class AnalysisResult(BaseModel):
    scores: Dict[str, Optional[float]]
    reasoning: Dict[str, str] = Field(default_factory=dict)
    radar_data: List[Optional[float]] = Field(default_factory=list)
    comments: str
    turn_attributions: List[TurnAttribution] = Field(default_factory=list)
    trajectory_features: TrajectoryFeatures


SCORE_PROMPT = """
你是 MAPLE 系统评分引擎。请基于用户对话行为评估四维分数（0-25）。
维度：
- know_understand
- use_apply
- evaluate_create
- ethics

规则：
1) 按行为证据评分，不按内容正确性评分。
2) 每个维度必须给出中文理由。
3) 输出必须是 JSON，不要 markdown。

格式：
{
  "scores": {
    "know_understand": 0-25,
    "use_apply": 0-25,
    "evaluate_create": 0-25,
    "ethics": 0-25
  },
  "reasoning": {
    "know_understand": "中文理由",
    "use_apply": "中文理由",
    "evaluate_create": "中文理由",
    "ethics": "中文理由"
  },
  "comments": "总体中文评语",
  "radar_data": [score1, score2, score3, score4]
}
"""


ATTRIBUTION_PROMPT = """
你是 MAPLE 维度归因器。请对“每一轮用户发言”做语义归因，不要使用关键词匹配式判断。

维度定义：
- know_understand: 对AI原理、限制、概念理解
- use_apply: 任务执行、提示词组织、应用操作
- evaluate_create: 质疑、验证、改写、共创
- ethics: 隐私、公平、风险、合规、安全

输出要求：
1) 必须返回 JSON，不要 markdown。
2) 每条包含 turn_index, dimension, confidence(0-1), reason(中文，简洁)。
3) dimension 必须是四个维度之一。

格式：
{
  "attributions": [
    {"turn_index": 1, "dimension": "use_apply", "confidence": 0.88, "reason": "用户在明确任务执行方式。"}
  ]
}
"""


def _extract_json(raw_text: str) -> Dict[str, Any]:
    cleaned = (raw_text or "").strip()
    if "</think>" in cleaned:
        cleaned = re.sub(r"^[\s\S]*?</think>", "", cleaned, flags=re.IGNORECASE).strip()
    else:
        cleaned = re.sub(r"<think>[\s\S]*?</think>", "", cleaned, flags=re.IGNORECASE).strip()

    block = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", cleaned, re.IGNORECASE)
    if block:
        return json.loads(block.group(1))

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(cleaned[start : end + 1])

    return json.loads(cleaned)


def _safe_dimension(value: str) -> str:
    return value if value in VALID_DIMENSIONS else "use_apply"


def _pre_validate_input(logs: List[Dict[str, Any]]) -> bool:
    user_messages = [msg.get("content", "") for msg in logs if msg.get("role") == "user"]
    if not user_messages:
        return False
    total_length = sum(len(msg.strip()) for msg in user_messages)
    return total_length >= 5


def _sanitize_logs(logs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [m for m in logs if m.get("role") in {"user", "assistant", "ai"}]


def _fallback_attributions(user_turns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    for turn in user_turns:
        text = turn.get("content", "").lower()
        dimension = "use_apply"
        reason = "默认归入应用维度。"
        if any(word in text for word in ["隐私", "偏见", "版权", "合规", "safety", "privacy", "bias"]):
            dimension = "ethics"
            reason = "内容涉及安全/伦理风险。"
        elif any(word in text for word in ["为什么", "原理", "幻觉", "token", "知识截止"]):
            dimension = "know_understand"
            reason = "内容涉及AI原理或理解。"
        elif any(word in text for word in ["验证", "来源", "证据", "重写", "改写", "评估"]):
            dimension = "evaluate_create"
            reason = "内容体现验证或共创。"
        result.append(
            {
                "turn_index": turn["turn_index"],
                "dimension": dimension,
                "confidence": 0.4,
                "reason": reason,
            }
        )
    return result


def _compute_trajectory(attributions: List[Dict[str, Any]]) -> TrajectoryFeatures:
    if not attributions:
        return TrajectoryFeatures(
            dimension_diversity=0.0,
            jump_density=0.0,
            ethics_reached=False,
            longest_stay_dimension="none",
            longest_stay_rounds=0,
            pattern="insufficient_data",
        )

    dims = [_safe_dimension(item.get("dimension", "use_apply")) for item in attributions]
    n = len(dims)
    counts: Dict[str, int] = {d: 0 for d in VALID_DIMENSIONS}
    for d in dims:
        counts[d] += 1

    # Shannon entropy (base 2)
    entropy = 0.0
    for c in counts.values():
        if c == 0:
            continue
        p = c / n
        entropy -= p * math.log2(p)

    jumps = 0
    longest_dim = dims[0]
    longest_rounds = 1
    current_dim = dims[0]
    current_run = 1
    for i in range(1, n):
        if dims[i] != dims[i - 1]:
            jumps += 1
        if dims[i] == current_dim:
            current_run += 1
        else:
            if current_run > longest_rounds:
                longest_rounds = current_run
                longest_dim = current_dim
            current_dim = dims[i]
            current_run = 1
    if current_run > longest_rounds:
        longest_rounds = current_run
        longest_dim = current_dim

    jump_density = jumps / n
    ethics_reached = counts["ethics"] > 0

    if entropy >= 1.5 and jump_density >= 0.35 and ethics_reached:
        pattern = "balanced_reflective"
    elif longest_rounds >= max(3, math.ceil(n * 0.6)):
        pattern = "focused_depth"
    else:
        pattern = "exploratory_transition"

    return TrajectoryFeatures(
        dimension_diversity=round(entropy, 4),
        jump_density=round(jump_density, 4),
        ethics_reached=ethics_reached,
        longest_stay_dimension=longest_dim,
        longest_stay_rounds=longest_rounds,
        pattern=pattern,
    )


def _score_with_model(logs: List[Dict[str, Any]]) -> Dict[str, Any]:
    raw = chat_completion_with_fallback(
        messages=[
            {"role": "system", "content": SCORE_PROMPT},
            {
                "role": "user",
                "content": (
                    f"对话记录：\n{json.dumps(logs, ensure_ascii=False)}\n"
                    "请输出 JSON 评分结果。"
                ),
            },
        ],
        temperature=0.2,
    )
    return _extract_json(raw or "{}")


def _attribute_with_model(user_turns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    raw = chat_completion_with_fallback(
        messages=[
            {"role": "system", "content": ATTRIBUTION_PROMPT},
            {
                "role": "user",
                "content": (
                    f"用户发言列表：\n{json.dumps(user_turns, ensure_ascii=False)}\n"
                    "请只输出 JSON。"
                ),
            },
        ],
        temperature=0.0,
    )
    parsed = _extract_json(raw or "{}")
    rows = parsed.get("attributions", [])
    if not isinstance(rows, list):
        return []
    return rows


@router.post("/", response_model=AnalysisResult)
async def analyze_session(request: AnalyzeRequest):
    conversation_logs = request.logs

    if not conversation_logs:
        conversation_logs = load_conversation_log_db(request.session_id)

    if not isinstance(conversation_logs, list) or len(conversation_logs) == 0:
        raise HTTPException(status_code=404, detail="No cloud conversation logs found for this session.")

    conversation_logs = _sanitize_logs(conversation_logs)

    if not _pre_validate_input(conversation_logs):
        empty_scores = {
            "know_understand": 0,
            "use_apply": 0,
            "evaluate_create": 0,
            "ethics": 0,
        }
        empty_attr: List[TurnAttribution] = []
        return AnalysisResult(
            scores=empty_scores,
            reasoning={
                "know_understand": "输入过短，未展示理解证据。",
                "use_apply": "输入过短，无法判断应用能力。",
                "evaluate_create": "缺少可评估的验证/共创行为。",
                "ethics": "未触及伦理相关内容。",
            },
            radar_data=[0, 0, 0, 0],
            comments="交互内容过少，判定为无效交互（Silence/Distractor）。",
            turn_attributions=empty_attr,
            trajectory_features=_compute_trajectory([]),
        )

    try:
        score_json = _score_with_model(conversation_logs)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {exc}")

    user_turns = []
    user_index = 0
    for msg in conversation_logs:
        if msg.get("role") != "user":
            continue
        user_index += 1
        user_turns.append(
            {
                "turn_index": user_index,
                "role": "user",
                "content": msg.get("content", ""),
            }
        )

    try:
        attrs_raw = _attribute_with_model(user_turns)
        if not attrs_raw:
            attrs_raw = _fallback_attributions(user_turns)
    except Exception:
        attrs_raw = _fallback_attributions(user_turns)

    attr_by_index: Dict[int, Dict[str, Any]] = {}
    for row in attrs_raw:
        try:
            idx = int(row.get("turn_index"))
        except Exception:
            continue
        attr_by_index[idx] = {
            "dimension": _safe_dimension(str(row.get("dimension", "use_apply"))),
            "confidence": row.get("confidence"),
            "reason": str(row.get("reason", "语义归因结果。")),
        }

    turn_attributions: List[TurnAttribution] = []
    for turn in user_turns:
        row = attr_by_index.get(turn["turn_index"])
        if row is None:
            row = {
                "dimension": "use_apply",
                "confidence": 0.3,
                "reason": "缺少明确证据，默认归入应用维度。",
            }
        turn_attributions.append(
            TurnAttribution(
                turn_index=turn["turn_index"],
                role=turn["role"],
                content=turn["content"],
                dimension=row["dimension"],
                confidence=row.get("confidence"),
                reason=row["reason"],
            )
        )

    trajectory = _compute_trajectory([a.model_dump() for a in turn_attributions])

    scores = score_json.get("scores", {})
    reasoning = score_json.get("reasoning", {})
    for key in VALID_DIMENSIONS:
        if key not in scores:
            scores[key] = 0
        if key not in reasoning:
            reasoning[key] = "模型未返回该维度解释。"

    radar_data = score_json.get(
        "radar_data",
        [scores.get("know_understand", 0), scores.get("use_apply", 0), scores.get("evaluate_create", 0), scores.get("ethics", 0)],
    )

    result = AnalysisResult(
        scores=scores,
        reasoning=reasoning,
        radar_data=radar_data,
        comments=score_json.get("comments", "暂无评语。"),
        turn_attributions=turn_attributions,
        trajectory_features=trajectory,
    )

    # Persist analysis output to cloud DB
    try:
        ok_judge = save_judge_result_db(
            session_id=request.session_id,
            scores=result.scores,
            feedback_text=result.comments,
            reasoning=result.reasoning,
            radar_data=result.radar_data,
            trajectory_features=result.trajectory_features.model_dump(),
            judge_model=os.getenv("MS_MODEL", "deepseek-ai/DeepSeek-R1-distill-Qwen-7B"),
            metadata={"source": "analyze_endpoint"},
        )
        if not ok_judge:
            raise HTTPException(status_code=500, detail="Cloud judge result persistence failed.")
        for attr in result.turn_attributions:
            ok_dispatch = save_dispatcher_log_db(
                session_id=request.session_id,
                round_no=attr.turn_index,
                user_utterance=attr.content,
                assigned_dimension=attr.dimension,
                confidence=attr.confidence,
                reason=attr.reason,
                metadata={"source": "analyze_attribution"},
            )
            if not ok_dispatch:
                raise HTTPException(status_code=500, detail="Cloud dispatcher persistence failed.")
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        print(f"Failed to persist analysis artifacts: {exc}")
        raise HTTPException(status_code=500, detail="Cloud persistence failed during analysis.")

    return result
