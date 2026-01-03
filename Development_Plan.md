# MAPLE 系统开发计划 (Development Plan)

基于 `Design.md` 中提出的 AI 素养评估模型与系统改造愿景，本计划旨在将现有的静态原型转化为功能完整的 Human-AI-Agent Loop 系统。

## 1. 项目架构规划 (Architecture)

### 1.1 目录结构建议
```
MAPLE/
├── docs/                  # 设计与规划文档
│   ├── Design.md
│   └── Development_Plan.md
├── backend/               # 后端服务 (建议使用 Python/FastAPI)
│   ├── app/
│   │   ├── agents/        # 核心 Agent 逻辑 (Analysis Agent)
│   │   ├── api/           # API 接口定义
│   │   ├── database/      # 数据库连接与 CRUD
│   │   └── models/        # 数据模型 (Pydantic/SQLAlchemy)
│   ├── tests/             # 单元测试
│   └── requirements.txt
├── frontend/              # 前端应用
│   ├── dashboard/         # 评估仪表盘 (对应 evaluation_dashboard.html)
│   ├── chatbot/           # 学习助手 (对应 learning_chatbot_interface.html)
│   └── assets/            # 静态资源
└── data/                  # 存储示例日志、Prompt 模板等
```

### 1.2 技术栈选型建议
*   **后端**: Python (FastAPI/Flask) - 方便接入 LLM 生态 (LangChain/LlamaIndex)。
*   **数据库**: PostgreSQL 或 MongoDB - 存储结构化的用户会话日志 (Conversation Logs)。
*   **LLM 接入**: OpenAI API / Anthropic API / Local LLM。
*   **前端**: 继续沿用 HTML/TailwindCSS 原型，或迁移至 Vue/React 以获得更好的状态管理。

---

## 2. 开发阶段分解 (Phased Roadmap)

### Phase 1: 基础设施与数据流 (Infrastructure & Data Pipeline)
**目标**: 实现基本的聊天功能，并能完整记录“人-AI”交互日志。

*   **[Backend] 数据库设计**:
    *   设计 `Session` 表：存储会话元数据（用户ID、时间、主题）。
    *   设计 `Message` 表：存储每一轮对话（Role: User/AI, Content, Timestamp）。
    *   **关键点**: 确保数据结构支持 `Design.md` 中要求的 `User Prompt -> AI Response -> User Reaction` 链条重现。
*   **[Backend] 基础 Chat API**:
    *   实现 `/chat` 接口，对接 LLM 返回回复。
    *   实现日志持久化逻辑。
*   **[Frontend] 页面对接**:
    *   改造 `learning_chatbot_interface.html`，使其能发送真实请求并显示历史消息。

### Phase 2: 分析师 Agent 开发 (Analysis Agent Core)
**目标**: 实现后台“看着”学生学习的 Agent，基于 Prompt Engineering 产出评估。

*   **[Core] Prompt Engineering**:
    *   根据 `Design.md` 的四个维度（协同创造力、评估批判、技术应用、伦理）编写 System Prompt。
    *   构建 Few-Shot 示例，教 Agent 如何识别“幻觉纠正”或“高级 Prompt 技巧”。
*   **[Backend] 分析服务开发**:
    *   实现 `/analyze` 接口：接收 Session ID，读取完整日志，投喂给 Analysis Agent。
    *   解析 Agent 输出：将非结构化的文本评价转化为结构化数据（JSON: 分数、雷达图数据、评语）。

### Phase 3: 可视化与反馈闭环 (Visualization & Feedback)
**目标**: 将评估结果直观展示给用户（或教师）。

*   **[Frontend] 仪表盘对接**:
    *   改造 `evaluation_dashboard.html`，通过 API 获取真实的分析数据。
    *   实现雷达图的动态渲染（使用 Chart.js 或 ECharts）。
    *   展示生成的文本评语。
*   **[System] 实时性优化**:
    *   (可选) 尝试流式分析：每隔 N 轮对话自动触发一次轻量级评估。

### Phase 4: 验证与调优 (Evaluation & Refinement)
**目标**: 确保 Agent 的评分与人类专家的判断一致。

*   **[Test] 黄金数据集构建**:
    *   收集 10-20 个典型的学生对话案例（包含高/低素养表现）。
    *   人工进行标注和打分。
*   **[Test] 自动评估测试**:
    *   运行 Analysis Agent，对比 Agent 评分与人工评分的差异。
    *   迭代优化 System Prompt，直到一致性达到可接受水平。

---

## 3. 下一步立即执行的任务 (Next Steps)

1.  **整理文件结构**: 将现有的 HTML 文件移动到 `frontend` 目录，创建 `backend` 目录。
2.  **环境初始化**: 设置 Python 虚拟环境，安装 FastAPI 和 Uvicorn。
3.  **编写 Analysis Agent 原型**: 创建一个简单的 Python 脚本，测试 `Design.md` 中设计的 Prompt 是否能从模拟日志中提取出有效信息。


优化
1. 完善切换专家角色的触发条件，因为现在意图识别准确度不够
2. 可以进行对话中的文本复制
3. 对历史会话继续提问会“遇到错误”
4. 登录注册
5. 删除 tools、thinking、语音输入，添加文件上传
6. 评估仪表盘的本学期、历史对话
7. 对评分优秀的提示词进行高亮，这样可以让用户感知写什么样的提示词是好的
8. 切换模型，用户可以选择不同的模型进行对话
9. 对评分优秀的提示词进行分类存储，用户可以在未来的对话中使用这些提示词
10. 推理思考过程可视化
