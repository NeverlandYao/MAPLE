from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import json
import re
from pathlib import Path
from openai import OpenAI

router = APIRouter()

# Initialize OpenAI client (sharing config from chat.py implicitly via env)
client = OpenAI(
    api_key=os.getenv("MS_API_KEY"),
    base_url=os.getenv("MS_BASE_URL")
)

DATA_DIR = Path("data/logs")

class AnalyzeRequest(BaseModel):
    session_id: str
    # logs are optional in request because we can load them from disk if session_id is provided
    logs: List[Dict[str, Any]] = None 

class AnalysisResult(BaseModel):
    scores: Dict[str, Optional[float]] # Allow float
    reasoning: Dict[str, str] = {} # Default empty
    radar_data: List[Optional[float]] = [] # Allow float and default empty
    comments: str

# Revised Evidence-Based Scoring System Prompt
SYSTEM_PROMPT = """
### 评分方法论：加权命中/未命中 (Binary Hit/Miss with Weights)

你是 MAPLE 系统的核心评分引擎，目标是基于学生是否**“命中 (Hit)”**高阶素养行为，计算每个维度（0-25分）的加权得分，并解释原因。

### 评分量表 (Hit/Miss 逻辑)
#### 1. 知识与理解 (Know & Understand)
- **权重**：1.5 (难度：中等)
- **命中 (HIT, +1)**：明确提及模型限制（如“知识截止”、“幻觉”）或主动纠正技术概念错误。
- **未命中 (MISS, 0)**：使用错误术语（如把 LLM 叫成“搜索引擎”）或未表现出对 AI 原理的理解。
- **评分标准**：
    - 25分 (深度理解)：明确提及幻觉、知识截止、Token限制等技术原理，或主动纠正 AI 的错误。
    - 15分 (基本理解)：术语使用准确（如 Prompt, Context），清楚 AI 的辅助定位，能区分搜索与生成。
    - 5分 (表面交互)：仅把 AI 当作搜索引擎或聊天机器人，术语模糊。
    - 0分 (概念错误/无关)：存在明显概念错误（如“你有意识吗”）或完全无关。

#### 2. 使用与应用 (Use & Apply)
- **权重**：1.0 (难度：低)
- **命中 (HIT, +1)**：用户明确定义了角色 (Persona)、任务 (Task) **和** 约束条件 (Constraints)（即结构化提示词），或使用了思维链 (CoT)/少样本 (Few-shot)。
- **未命中 (MISS, 0)**：用户发送通用的单句指令 (Zero-shot) 或简单的对话填充词。
- **评分标准**：
    - 25分 (高级策略)：应用思维链 (CoT)、少样本 (Few-shot) 或复杂的角色扮演技巧。
    - 15分 (结构化提示)：提示词包含明确的角色、任务、约束条件 (Constraints) 或上下文。
    - 5分 (基础指令)：仅发送简单的单轮指令 (Zero-shot) 或日常对话。
    - 0分 (无效/沉默)：无意义的输入或未进行任务相关的操作。

#### 3. 评估与创造 (Evaluate & Create)
- **权重**：2.0 (难度：高)
- **命中 (HIT, +1)**：用户明确质疑 AI 输出的有效性（事实核查、索要来源），或注入了深刻的教学洞察（共创）。
- **未命中 (MISS, 0)**：用户在未验证的情况下接受 AI 回复，或仅修改错别字。
- **评分标准**：
    - 25分 (批判性评估/共创)：明确的事实核查、逻辑质疑、索要来源或高阶的观点融合。
    - 15分 (实质性修改)：对生成内容进行大幅重写、结构调整或风格迁移。
    - 5分 (基本检查)：简单的格式调整、错别字修正或确认收到（表现出最小限度的“人在回路”）。
    - 0分 (盲目接受)：完全复制粘贴或无条件接受，未展现任何验证迹象。

#### 4. 伦理 (Ethics)
- **权重**：1.5 (难度：中等)
- **命中 (HIT, +1)**：用户主动添加安全约束（如“确保无性别偏见”）或询问潜在风险。
- **未命中 (MISS, 0)**：用户无视潜在风险或未提及任何伦理参数。
- **评分标准**：
    - 25分 (前置防御)：在生成前主动设定伦理边界（如“不含偏见”、“保护隐私”）。
    - 15分 (主动询问)：对潜在的伦理风险、数据安全或算法偏见提出疑问。
    - 5分 (被动合规)：确认收到系统的伦理警告，或在被提示后进行修正。
    - 0分 (忽视/沉默)：无视潜在风险，或未涉及任何伦理维度的思考。

### 输出格式
**必须是有效的 JSON 格式**。
**评语必须使用简体中文**。
{
    "scores": {
        "know_understand": 0-25,
        "use_apply": 0-25,
        "evaluate_create": 0-25,
        "ethics": 0-25
    },
    "reasoning": {
        "know_understand": "为什么给这个分？解释Hit了什么或Miss了什么...",
        "use_apply": "...",
        "evaluate_create": "...",
        "ethics": "..."
    },
    "comments": "总体中文评语...",
    "radar_data": [score1, score2, score3, score4] 
}
"""

def pre_validate_input(logs: List[Dict[str, Any]]) -> bool:
    """
    代码层保障：最小长度过滤器
    如果输入太短/无效，无法证明具备素养，直接返回 False。
    """
    user_messages = [msg['content'] for msg in logs if msg['role'] == 'user']
    if not user_messages:
        return False
    
    # 检查用户输入总长度（例如 > 5 字符）
    # GLAT 逻辑：沉默是干扰项（0分），但为了节省 API 调用，我们在此处过滤“噪音”。
    # 如果在此处过滤，我们将返回默认的低分结果。
    total_length = sum(len(msg.strip()) for msg in user_messages)
    if total_length < 5:
        return False
        
    return True

@router.post("/", response_model=AnalysisResult)
async def analyze_session(request: AnalyzeRequest):
    conversation_logs = request.logs
    
    # 1. Fallback to Disk if logs not provided in request (Backward Compatibility)
    if not conversation_logs:
        log_file = DATA_DIR / f"{request.session_id}.json"
        if log_file.exists():
            try:
                with open(log_file, "r", encoding="utf-8") as f:
                    file_content = json.load(f)
                    
                    # Handle if file content is dict with "messages" key (common in exports)
                    if isinstance(file_content, dict) and "messages" in file_content:
                        conversation_logs = file_content["messages"]
                    elif isinstance(file_content, list):
                        conversation_logs = file_content
                    else:
                        print(f"Invalid log format for session {request.session_id}: {type(file_content)}")
                        # Don't crash, just set empty to trigger 400 later
                        conversation_logs = []
            except json.JSONDecodeError:
                print(f"Invalid JSON in log file: {log_file}")
                raise HTTPException(status_code=400, detail="Invalid JSON format in session log file.")
            except Exception as e:
                print(f"Error reading log file: {e}")
                raise HTTPException(status_code=500, detail=f"Error reading log file: {str(e)}")
        else:
            # If also not found on disk, raise 404
            raise HTTPException(status_code=404, detail="Session logs not found. Please ensure logs are provided or saved.")

    # Ensure logs is a list before processing
    if not isinstance(conversation_logs, list):
         # If it's still not a list (e.g. provided in request but wrong type? Pydantic should catch that, but good to be safe)
         raise HTTPException(status_code=400, detail="Conversation logs must be a list of messages.")

    if not conversation_logs or len(conversation_logs) == 0:
         raise HTTPException(status_code=400, detail="Conversation logs are empty")

    # 1. Code-Level Safeguard (Treat as Miss/Distractor)
    if not pre_validate_input(conversation_logs):
        # Return 0 Scores directly (GLAT: Silence = 0)
        return AnalysisResult(
            scores={
                "know_understand": 0,
                "use_apply": 0,
                "evaluate_create": 0,
                "ethics": 0
            },
            reasoning={
                "know_understand": "输入过短，未展示任何理解。",
                "use_apply": "输入过短，无法判断应用能力。",
                "evaluate_create": "沉默或被动交互被视为干扰项。",
                "ethics": "未提及任何伦理内容。"
            },
            radar_data=[0, 0, 0, 0],
            comments="交互内容过少，判定为无效交互（Silence/Distractor），得分为 0。"
        )

    try:
        # Call ModelScope/OpenAI API for Analysis
        # Use a slightly more capable model for analysis if possible, or same DeepSeek
        # DeepSeek R1 is excellent at reasoning, so it fits the "Evidence-Based Scoring" perfectly.
        completion = client.chat.completions.create(
            model=os.getenv("MS_MODEL", "deepseek-ai/DeepSeek-R1-distill-Qwen-7B"),
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"对话记录如下：\n{json.dumps(conversation_logs, ensure_ascii=False)}\n\n请严格按照 System Prompt 要求，输出有效的 JSON 格式评分结果。不要输出任何 Markdown 代码块标记之外的文本。"}
            ],
            temperature=0.2,
            extra_body={"enable_thinking": False} # Must be False for non-streaming calls
        )
        
        raw_response = completion.choices[0].message.content.strip()
        
        # DeepSeek R1 output might contain <think>...</think>. We need to strip it to get JSON.
        # It handles multiline think tags
        if "<think>" in raw_response:
             # Remove thinking process to extract JSON
             raw_response = re.sub(r'<think>[\s\S]*?</think>', '', raw_response, flags=re.DOTALL).strip()
        
        # Robust JSON Extraction
        json_str = raw_response
        # 1. Try to find content inside ```json ... ``` or ``` ... ```
        json_block_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', raw_response, re.IGNORECASE)
        
        if json_block_match:
            json_str = json_block_match.group(1)
        else:
            # 2. Fallback: Find first '{' and last '}'
            start_idx = raw_response.find('{')
            end_idx = raw_response.rfind('}')
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                json_str = raw_response[start_idx:end_idx+1]
            
        # Debug: Print cleaned response
        print(f"Cleaned Analysis Response: {json_str[:100]}...")

        result_json = json.loads(json_str.strip())
        
        # 3. Normalize Keys (Chinese to English mapping if needed)
        # Model might return Chinese keys despite instructions.
        key_mapping = {
            "知识与理解": "know_understand",
            "知识": "know_understand",
            "理解": "know_understand",
            "应用与分析": "use_apply",
            "使用与应用": "use_apply",
            "应用": "use_apply",
            "分析": "use_apply",
            "评估与创造": "evaluate_create",
            "评估": "evaluate_create",
            "创造": "evaluate_create",
            "评价": "evaluate_create",
            "伦理": "ethics",
            "道德": "ethics",
            "ethics": "ethics",
            "know_understand": "know_understand",
            "use_apply": "use_apply",
            "evaluate_create": "evaluate_create"
        }
        
        # Ensure scores dict exists
        if "scores" not in result_json:
            result_json["scores"] = {}

        # Normalize scores
        new_scores = {}
        # If model returned "rating" instead of scores (hallucination fallback)
        if not result_json["scores"] and "rating" in result_json:
             # Assign the single rating to all fields vaguely? Or just keep 0?
             # Let's keep 0 but put the rating in comments/reasoning
             pass
             
        for k, v in result_json["scores"].items():
            # Fuzzy match? 
            normalized_key = key_mapping.get(k)
            if not normalized_key:
                # Try to guess from partial match
                for map_k, map_v in key_mapping.items():
                    if map_k in k:
                        normalized_key = map_v
                        break
            
            if normalized_key:
                new_scores[normalized_key] = v
        
        # Ensure all 4 keys exist in scores (default to 0)
        required_keys = ["know_understand", "use_apply", "evaluate_create", "ethics"]
        for key in required_keys:
            if key not in new_scores:
                new_scores[key] = 0.0
                
        result_json["scores"] = new_scores

        # Normalize reasoning
        if "reasoning" not in result_json:
             result_json["reasoning"] = {}
             
        new_reasoning = {}
        for k, v in result_json["reasoning"].items():
            normalized_key = key_mapping.get(k)
            if not normalized_key:
                for map_k, map_v in key_mapping.items():
                    if map_k in k:
                        normalized_key = map_v
                        break
            if normalized_key:
                new_reasoning[normalized_key] = v
        result_json["reasoning"] = new_reasoning

        # 4. Auto-Calculate Radar Data if missing or empty
        # Frontend expects: [use_apply, know_understand, evaluate_create, ethics]
        
        if "radar_data" not in result_json or not result_json["radar_data"]:
            scores = result_json.get("scores", {})
            result_json["radar_data"] = [
                scores.get("use_apply", 0) or 0,
                scores.get("know_understand", 0) or 0,
                scores.get("evaluate_create", 0) or 0,
                scores.get("ethics", 0) or 0
            ]
        
        return AnalysisResult(**result_json)

    except json.JSONDecodeError:
        print(f"Failed to decode Agent response: {json_str}")
        return AnalysisResult(
            scores={"know_understand": 0, "use_apply": 0, "evaluate_create": 0, "ethics": 0},
            reasoning={"error": "Analysis model returned invalid JSON. Please try again."},
            radar_data=[0, 0, 0, 0],
            comments="系统评分服务暂时繁忙，请重试。"
        )
    except Exception as e:
        print(f"Error during analysis (General/Validation): {e}")
        # Also return fallback for other errors (like Pydantic validation) to avoid 500 crash
        return AnalysisResult(
            scores={"know_understand": 0, "use_apply": 0, "evaluate_create": 0, "ethics": 0},
            reasoning={"error": f"Analysis failed: {str(e)}"},
            radar_data=[0, 0, 0, 0],
            comments="系统评分服务暂时繁忙，请重试。"
        )