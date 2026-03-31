import json
import os
import re
import time
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.config import load_backend_env
from app.database.db import (
    delete_session_db,
    ensure_session_db,
    list_sessions_db,
    load_session_detail_db,
    save_dispatcher_log_db,
    sync_session_messages_db,
    update_session_snapshot_db,
    upsert_interaction_log_db,
)
from app.llm import chat_completion_with_fallback

load_backend_env()

router = APIRouter()


class Message(BaseModel):
    role: str
    content: str
    agent_id: Optional[str] = Field(default=None, alias="agentId")


class ChatRequest(BaseModel):
    session_id: str
    messages: List[Message]
    user_name: Optional[str] = "Learner"
    expert_role: Optional[str] = "general"
    max_tokens: Optional[int] = 320


class ChatResponse(BaseModel):
    response: str
    timestamp: float


class SessionDetailResponse(BaseModel):
    session_id: str
    user_name: str
    title: str = ""
    timestamp: float
    message_count: int
    messages: List[Message]


class IntentClassifyRequest(BaseModel):
    text: str
    recent_messages: List[Message] = Field(default_factory=list)
    available_agents: List[str] = Field(default_factory=lambda: ["general", "tech", "pedagogy", "ethics"])
    session_id: Optional[str] = None
    round_no: Optional[int] = None


class IntentClassifyResponse(BaseModel):
    agent_id: str
    reason: str
    confidence: float


class SyncSessionRequest(BaseModel):
    session_id: str
    user_name: Optional[str] = "Learner"
    messages: List[Message] = Field(default_factory=list)


INTENT_ROUTER_PROMPT = """
你是 MAPLE 对话分发器。你只做一件事：根据用户输入语义判断应当由哪个专家回复。

候选专家：
- general: 通用支持、闲聊、无法明确归属时
- tech: 代码、算法、系统实现、调试、接口、模型技术细节
- pedagogy: 教学设计、学习目标、课堂活动、评价方案、学生理解路径
- ethics: 隐私、偏见、合规、安全风险、版权、学术诚信

规则：
1. 必须基于语义，不要依赖关键词字面命中。
2. 如果含明显伦理风险，优先 ethics。
3. 如果无法确定，返回 general。
4. 只输出 JSON，格式如下：
{
  "agent_id": "general|tech|pedagogy|ethics",
  "reason": "一句中文理由",
  "confidence": 0.0-1.0
}
"""

ANSWER_GUARD_PROMPT = """
你是 MAPLE 的最终回答层。
请严格按以下结构输出（只允许一个标签）：
<answer>给用户看到的最终回答</answer>

要求：
1) <answer>必须是直接回答，不要包含推理过程，不要包含“我先/我将/我需要”等自述。
2) <answer>中文、简洁（优先 2-4 句）。
3) 除上述标签外不要输出其他内容。
"""


def _extract_json(raw_text: str):
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


def _normalize_agent(agent_id: str, available_agents: List[str]) -> str:
    allowed = {"general", "tech", "pedagogy", "ethics"}
    available = [a for a in available_agents if a in allowed] or ["general", "tech", "pedagogy", "ethics"]
    if agent_id in available:
        return agent_id
    return "general" if "general" in available else available[0]


def _extract_answer_only(raw_text: str) -> str:
    text = (raw_text or "").strip()
    if not text:
        return ""

    # Strip reasoning blocks. Some models output </think> without the opening <think>.
    if "</think>" in text:
        no_think = re.sub(r"^[\s\S]*?</think>", "", text, flags=re.IGNORECASE).strip()
    else:
        no_think = re.sub(r"<think>[\s\S]*?</think>", "", text, flags=re.IGNORECASE).strip()
        no_think = re.sub(r"<think>[\s\S]*", "", no_think, flags=re.IGNORECASE).strip()

    # Strict format: <answer>...</answer>
    answer_match = re.search(r"<answer>([\s\S]*?)</answer>", no_think, flags=re.IGNORECASE)
    if answer_match:
        return (answer_match.group(1) or "").strip()

    # Remove stray <answer> wrapper tags
    no_think = re.sub(r"</?answer>", "", no_think, flags=re.IGNORECASE).strip()

    if no_think:
        # Secondary fallback markers
        markers = ["最终答案：", "最终答案:", "回答：", "回答:", "Final Answer:", "Final Answer："]
        for marker in markers:
            if marker in no_think:
                return no_think.split(marker, 1)[1].strip()
        return no_think

    return ""


def _sanitize_user_visible_answer(text: str) -> str:
    t = (text or "").strip()
    if not t:
        return ""

    # Remove model-internal tags and wrappers if leaked.
    t = re.sub(r"<\/?think>", "", t, flags=re.IGNORECASE).strip()
    t = re.sub(r"<\/?analysis>", "", t, flags=re.IGNORECASE).strip()
    t = re.sub(r"<\/?answer>", "", t, flags=re.IGNORECASE).strip()
    t = re.sub(r"```(?:\w+)?", "", t).strip()

    lines = [ln.strip() for ln in t.splitlines() if ln.strip()]
    if not lines:
        return ""

    reasoning_line = re.compile(
        r"^(思考|推理|分析|计划|步骤|先分析|让我|我先|我将|reasoning|analysis)\s*[:：]?",
        re.IGNORECASE,
    )
    lines = [ln for ln in lines if not reasoning_line.search(ln)]
    return "\n".join(lines).strip()


def _truncate_text(text: str, max_chars: int = 280) -> str:
    t = (text or "").strip()
    if len(t) <= max_chars:
        return t
    shortened = t[:max_chars].rstrip()
    # Prefer cutting at a natural Chinese punctuation boundary.
    m = re.search(r"^(.+[。！？；.!?])", shortened)
    if m:
        return m.group(1)
    return shortened + "..."


def _strip_reasoning_sentences(text: str) -> str:
    raw = (text or "").strip()
    if not raw:
        return raw
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    filtered: List[str] = []
    ban = re.compile(r"(思考|推理|我先|我将|我需要|让我|先分析|步骤如下|分析过程|reasoning|chain of thought)", re.IGNORECASE)
    for ln in lines:
        if ban.search(ln):
            continue
        filtered.append(ln)
    cleaned = "\n".join(filtered).strip()
    return cleaned or raw


def _looks_like_prompt_echo(text: str) -> bool:
    t = (text or "").strip()
    if not t:
        return True
    suspicious_patterns = [
        "你是 MAPLE 的最终回答层",
        "请严格按以下结构输出",
        "<think>",
        "思考过程",
        "推理过程",
    ]
    return any(p in t for p in suspicious_patterns)


def _persist_chat_round(
    session_id: str,
    user_name: str,
    expert_role: Optional[str],
    messages_payload: List[dict],
    answer: str,
) -> None:
    session_ok = ensure_session_db(session_id, user_name=user_name or "Learner", source="chatbot")
    if not session_ok:
        print("Warning: Cloud session persistence unavailable, continuing chat response.")
        return

    non_system = [m for m in messages_payload if m["role"] in {"user", "assistant", "ai", "expert"}]
    user_turns = [m for m in non_system if m["role"] == "user"]
    if not user_turns:
        return

    round_no = len(user_turns)
    latest_user = user_turns[-1]["content"]
    ok_user = upsert_interaction_log_db(session_id, round_no, "user", latest_user, metadata={"source": "chat_endpoint"})
    ok_ai = upsert_interaction_log_db(
        session_id,
        round_no,
        "expert",
        answer,
        expert_role=expert_role if expert_role in {"general", "tech", "pedagogy", "ethics"} else "general",
        metadata={"source": "chat_endpoint"},
    )
    if not (ok_user and ok_ai):
        print("Warning: Cloud interaction logging failed, response already generated.")
    _ = update_session_snapshot_db(
        session_id=session_id,
        title=(user_turns[0]["content"] if user_turns else "")[:80],
        last_message_preview=latest_user[:200],
        message_count=max(len(non_system), round_no * 2),
    )


@router.post("/classify-intent", response_model=IntentClassifyResponse)
async def classify_intent(request: IntentClassifyRequest):
    try:
        context_payload = [{"role": m.role, "content": m.content} for m in request.recent_messages[-6:]]
        raw = chat_completion_with_fallback(
            messages=[
                {"role": "system", "content": INTENT_ROUTER_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"候选专家：{request.available_agents}\n"
                        f"最近上下文：{json.dumps(context_payload, ensure_ascii=False)}\n"
                        f"当前用户输入：{request.text}\n"
                        "请返回 JSON。"
                    ),
                },
            ],
            temperature=0.0,
            max_tokens=80,  # routing only needs a short JSON reply
        )
        parsed = _extract_json(raw or "{}")
        agent_id = _normalize_agent(parsed.get("agent_id", "general"), request.available_agents)
        reason = str(parsed.get("reason", "语义路由结果"))
        confidence = float(parsed.get("confidence", 0.6))
        confidence = min(max(confidence, 0.0), 1.0)

        # Cloud-only dispatcher log
        if request.session_id and request.round_no:
            route_to_dimension = {
                "tech": "use_apply",
                "pedagogy": "evaluate_create",
                "ethics": "ethics",
                "general": "use_apply",
            }
            save_dispatcher_log_db(
                session_id=request.session_id,
                round_no=request.round_no,
                user_utterance=request.text,
                assigned_dimension=route_to_dimension.get(agent_id, "use_apply"),
                confidence=confidence,
                reason=reason,
                metadata={"source": "dispatcher_route"},
            )

        return IntentClassifyResponse(agent_id=agent_id, reason=reason, confidence=confidence)
    except Exception as exc:
        print(f"Intent classifier fallback: {exc}")
        return IntentClassifyResponse(agent_id="general", reason="分类器异常，回退到通用助手。", confidence=0.0)


@router.post("/", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, background_tasks: BackgroundTasks):
    # Roles accepted by all OpenAI-compatible APIs: system / user / assistant
    _ROLE_MAP = {"ai": "assistant", "expert": "assistant"}

    try:
        messages_payload = [
            {"role": _ROLE_MAP.get(msg.role, msg.role), "content": msg.content}
            for msg in request.messages
            if msg.role in {"system", "user", "assistant", "ai", "expert"}
        ]

        # Two chains:
        # - Expert mode: frontend sends the expert system_prompt as the first system message.
        #   Preserve expert identity but append the <answer> output format constraint so that
        #   _extract_answer_only can reliably strip inline reasoning from this model.
        # - General / plain mode: no system message from frontend → use ANSWER_GUARD_PROMPT.
        _ANSWER_SUFFIX = "\n\n只输出：<answer>中文直接回答，2-3句</answer>"
        has_system = any(m["role"] == "system" for m in messages_payload)
        if has_system:
            # Expert chain: inject output format into the expert system message (non-destructive copy)
            merged = []
            for m in messages_payload:
                if m["role"] == "system":
                    merged.append({"role": "system", "content": m["content"] + _ANSWER_SUFFIX})
                else:
                    merged.append(m)
            model_messages = merged
        else:
            model_messages = [{"role": "system", "content": ANSWER_GUARD_PROMPT}] + messages_payload
        raw_response = chat_completion_with_fallback(
            messages=model_messages,
            temperature=0.3,
            max_tokens=request.max_tokens or 240,
        )
        answer = _extract_answer_only(raw_response)
        answer = _sanitize_user_visible_answer(answer)
        answer = _strip_reasoning_sentences(answer)
        answer = _truncate_text(answer, max_chars=240) if answer else ""
        if not answer or _looks_like_prompt_echo(answer):
            answer = "请问有什么可以帮助你的吗？"

        background_tasks.add_task(
            _persist_chat_round,
            request.session_id,
            request.user_name or "Learner",
            request.expert_role,
            messages_payload,
            answer,
        )

        return ChatResponse(response=answer, timestamp=time.time())
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error calling Model API: {exc}")
        return ChatResponse(
            response="我这边临时连接不稳定，但我还在线。请重试一次，或把问题再发我一遍。",
            timestamp=time.time(),
        )


@router.get("/sessions", response_model=List[dict])
async def list_sessions():
    sessions = list_sessions_db(limit=300)
    if sessions is None:
        print("Warning: Cloud database unavailable for /api/chat/sessions, returning empty list.")
        return []
    return sessions


@router.get("/session/{session_id}", response_model=SessionDetailResponse)
async def get_session(session_id: str):
    detail = load_session_detail_db(session_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return detail


@router.post("/sync-session")
async def sync_session(request: SyncSessionRequest):
    messages_payload = [{"role": m.role, "content": m.content, "agent_id": m.agent_id} for m in request.messages]
    ok = sync_session_messages_db(
        session_id=request.session_id,
        user_name=request.user_name or "Learner",
        messages=messages_payload,
        source="frontend_sync",
    )
    if not ok:
        raise HTTPException(status_code=503, detail="Cloud session sync failed.")
    return {"ok": True, "session_id": request.session_id, "message_count": len(messages_payload)}


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    ok = delete_session_db(session_id)
    if not ok:
        raise HTTPException(status_code=500, detail=f"Failed to delete session {session_id} from database.")
    return {"ok": True, "session_id": session_id}
