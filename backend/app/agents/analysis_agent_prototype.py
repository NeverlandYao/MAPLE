import json
from typing import List, Dict

# Define the System Prompt based on Design.md
SYSTEM_PROMPT = """
你是一名**AI素养评估专家**。你的任务不是评价学生生成的‘内容’对不对，而是评价学生**‘使用AI的过程’**好不好。
请阅读以下学生与AI的交互日志，并关注以下四个维度：

1. **AI 协同创造力 (AI Co-Creativity)**
   - **迭代深度**：学生是否基于AI回复进行多轮追问与修改，而非单次采纳？
   - **观点增量**：学生是否引导AI产出了超出常规的新颖观点？
   - **融合度**：最终成果中是否有机融合了人类意图与AI生成内容？

2. **AI 评估与批判 (AI Evaluation)**
   - **幻觉识别**：当AI出现事实错误或逻辑漏洞时，学生是否能明确指出并纠正？
   - **交叉验证**：学生是否要求AI提供来源或通过多角度提问验证信息？
   - **质疑精神**：面对AI的模糊回答，学生是否表现出审慎态度而非盲目接受？

3. **技术与应用能力 (Technical Usage)**
   - **Prompt技巧**：学生是否使用了角色设定、少样本(Few-shot)、思维链(CoT)等高级技巧？
   - **格式控制**：学生能否精准控制输出格式（如Markdown、JSON、特定文风）？
   - **上下文管理**：学生是否有效利用上下文窗口，保持对话连贯性？

4. **AI 伦理与依赖 (Ethics & Dependency)**
   - **依赖倾向**：学生是索要“直接答案”还是索要“解题思路/脚手架”？
   - **偏见侦测**：提问是否包含诱导性偏见，或能否识别AI回复中的偏见？
   - **合规使用**：是否试图绕过安全限制，或用于学术不端行为？

请根据以上点，为该学生生成‘AI素养画像’。
输出格式要求为 JSON：
{
    "scores": {
        "co_creativity": 0-100,
        "evaluation": 0-100,
        "technical": 0-100,
        "ethics": 0-100
    },
    "comments": "你的详细评语...",
    "radar_data": [score1, score2, score3, score4]
}
"""

def mock_analyze_session(conversation_logs: List[Dict[str, str]]):
    """
    Mock function to simulate the analysis process.
    In a real scenario, this would call OpenAI/Anthropic API with the SYSTEM_PROMPT and conversation_logs.
    """
    print("--- Analysis Agent Prompt ---")
    print(SYSTEM_PROMPT)
    print("\n--- Input Conversation Logs ---")
    print(json.dumps(conversation_logs, indent=2, ensure_ascii=False))
    
if __name__ == "__main__":
    # Test Data
    mock_logs = [
        {"role": "user", "content": "帮我写一篇关于罗马历史的论文"},
        {"role": "ai", "content": "好的，罗马历史非常宏大。请问您具体关注哪个时期？"},
        {"role": "user", "content": "关注共和国晚期。请给我一个大纲。"},
        {"role": "ai", "content": "这是关于罗马共和国晚期的大纲..."},
        {"role": "user", "content": "第三点不太详细，请扩展一下，并引用Livius的观点。"}
    ]
    
    result = mock_analyze_session(mock_logs)
    print("\n--- Mock Analysis Result ---")
    print(json.dumps(result, indent=2, ensure_ascii=False))
