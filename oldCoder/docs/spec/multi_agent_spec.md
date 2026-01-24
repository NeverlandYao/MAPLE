# MAPLE 多 Agent 系统架构规范 (Multi-Agent Spec)

## 1. 概述 (Overview)
MAPLE (Multi-Agent Platform for Literacy Evaluation) 采用了一种**解耦的功能性多 Agent 架构**。该系统通过不同职责的 Agent 协作，实现从“用户对话交互”到“高阶素养评估”的全流程闭环。

核心理念是将**生成式任务**（Chat）与**评估式任务**（Analysis）分离，利用专门化的 System Prompt 驱动同一个基础模型（如 DeepSeek R1）扮演不同角色。

## 2. Agent 定义 (Agent Definitions)

### 2.1 聊天代理 (Chat Agent)
*   **职责**：负责与学生进行直接的知识对话，引导学生思考。
*   **核心组件**：`backend/app/api/chat.py`
*   **输入**：用户即时消息、历史对话上下文。
*   **输出**：AI 助教回复。
*   **存储机制**：实时将对话记录持久化至 `data/logs/{session_id}.json`，作为 Analysis Agent 的原始输入。

### 2.2 分析代理 (Analysis Agent)
*   **职责**：作为“AI 素养评估专家”，对学生的对话行为进行证据化评分。
*   **核心组件**：`backend/app/api/analyze.py`
*   **评估维度**：
    1.  **知识与理解 (Know & Understand)**：识别 AI 原理、术语准确性。
    2.  **使用与应用 (Use & Apply)**：Prompt 技巧（CoT, Few-shot, 结构化提示）。
    3.  **评估与创造 (Evaluate & Create)**：批判性思维、事实核查、内容共创。
    4.  **伦理 (Ethics)**：安全约束、偏见侦测、合规意识。
*   **原型参考**：`backend/app/agents/analysis_agent_prototype.py`

## 3. 协作机制 (Collaboration Mechanism)

### 3.1 共享状态 (Shared State)
系统不采用复杂的 Agent 协议（如 ACL），而是基于**对话日志 (Session Logs)** 进行异步协作。
*   `Chat Agent` 负责“生产”日志。
*   `Analysis Agent` 负责“消费”并审计日志。

### 3.2 评分方法论 (Scoring Methodology)
分析代理采用 **加权命中/未命中 (Weighted Hit/Miss)** 逻辑：
*   **HIT (+1)**：在对话中检测到特定高阶行为（如：明确质疑 AI 幻觉）。
*   **MISS (0)**：未表现出相关行为或盲目接受 AI 建议。
*   **权重分配**：根据维度难度设定不同的权重系数（如：评估与创造权重最高，为 2.0）。

## 4. 技术实现细节 (Technical Implementation)

### 4.1 鲁棒的 JSON 处理
由于分析任务要求高度结构化的输出，系统实现了多级 JSON 提取逻辑：
1.  **正则提取**：优先匹配 ` ```json ` 块。
2.  **边界匹配**：寻找首个 `{` 和最后一个 `}`。
3.  **清洗逻辑**：自动剔除 DeepSeek R1 产生的 `<think>` 思考标签。

### 4.2 键值对标准化 (Normalization)
为了兼容不同模型的语言倾向（有时输出中文 Key，有时输出英文 Key），系统内置了 `key_mapping` 映射表，确保前端接收到的数据格式统一为：
```json
{
    "scores": { "know_understand": 0, "use_apply": 0, "evaluate_create": 0, "ethics": 0 },
    "reasoning": { ... },
    "radar_data": [ ... ],
    "comments": "..."
}
```

### 4.3 输入预校验 (Pre-validation)
在调用昂贵的分析 Agent 前，通过 `pre_validate_input` 过滤低质量交互（如字数过少、无意义字符），直接判定为“干扰项 (Distractor)”，得分为 0，以节省 Token 消耗。

## 5. 扩展方向 (Future Extensions)
*   **实时评估 Agent**：将分析逻辑集成到流式对话中，实现即时反馈。
*   **策略 Agent**：根据分析代理的评估结果，动态调整聊天代理的教学策略（Scaffolding）。
