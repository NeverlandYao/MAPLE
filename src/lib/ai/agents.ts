export interface Agent {
  id: string;
  name: string;
  role: string;
  avatar_icon: string;
  color: string;
  bg_gradient: string;
  border_color: string;
  system_prompt: string;
}

export const AGENTS: Record<string, Agent> = {
  general: {
    id: 'general',
    name: 'MAPLE',
    role: 'AI Literacy Assistant',
    avatar_icon: 'smart_toy',
    color: 'text-primary',
    bg_gradient: 'from-orange-400 to-yellow-600',
    border_color: 'border-primary',
    system_prompt: "你现在是MAPLE，一个乐于助人的AI素养助手。请用中文回答用户的通用问题，保持友好和鼓励的态度。"
  },
  tech: {
    id: 'tech',
    name: 'The Technologist',
    role: 'Chief Technology Officer',
    avatar_icon: 'terminal',
    color: 'text-blue-400',
    bg_gradient: 'from-blue-500 to-cyan-400',
    border_color: 'border-blue-400',
    system_prompt: "你现在是技术专家(The Technologist)。风格：极客、代码导向、注重效率、专业。功能：提供高质量的Python代码，深入解释RAG、Transformer等技术原理，优化Prompt工程。请使用专业的技术术语，并给出具体的代码示例或技术架构分析。"
  },
  pedagogy: {
    id: 'pedagogy',
    name: 'The Pedagogue',
    role: 'Senior Researcher',
    avatar_icon: 'school',
    color: 'text-green-400',
    bg_gradient: 'from-green-500 to-emerald-400',
    border_color: 'border-green-400',
    system_prompt: "你现在是资深教研员(The Pedagogue)。风格：循循善诱、理论扎实、关注学生主体。功能：追问教学目标，提醒学情分析，建议PBL、脚手架等教学策略。不要直接给出答案，而是引导用户思考如何将AI更好地融入教学设计中。"
  },
  ethics: {
    id: 'ethics',
    name: 'The Ethicist',
    role: 'Ethics Reviewer',
    avatar_icon: 'gavel',
    color: 'text-red-400',
    bg_gradient: 'from-red-500 to-rose-400',
    border_color: 'border-red-400',
    system_prompt: "你现在是伦理审查员(The Ethicist)。你的首要任务是保障AI交互的安全性和合规性。当检测到潜在风险时，请首先以 **【伦理风险警告】** 开头，明确指出问题所在（如数据隐私、算法偏见、版权侵权等），然后提供合规的建议或替代方案。风格：严谨、客观、具有法律意识。"
  }
};

export function detectIntent(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Scoring System
  let scores: Record<string, number> = {
    tech: 0,
    pedagogy: 0,
    ethics: 0,
    general: 0
  };

  // Tech Keywords
  const techKeywords = /(code|python|bug|error|rag|prompt|api|function|debug|algorithm|json|optimization|performance|database|server|deploy|linux|terminal|script|variable|loop|class|object|inheritance|git|docker|kubernetes|代码|编程|报错|调试|接口|算法|优化|性能|数据库|服务器|部署|脚本|变量|循环|类|对象|继承)/i;
  if (techKeywords.test(lowerText)) scores.tech += 1;
  if (/```[\s\S]*?```|`[^`]+`/.test(text)) scores.tech += 0.5;

  // Pedagogy Keywords - Focused on "How to teach" and educational theory
  const pedagogyKeywords = /(student|teach|pbl|scaffolding|curriculum|assessment|bloom|classroom|quiz|test|grade|rubric|feedback|reflection|metacognition|学生|教学|目标|课程|评估|布鲁姆|课堂|教案|类比|测验|测试|评分|反馈|反思|元认知)/i;
  if (pedagogyKeywords.test(lowerText)) scores.pedagogy += 1;
  // Boost if "teach" or "classroom" appears explicitly
  if (/(teach|classroom|教学|课堂|教案)/i.test(lowerText)) scores.pedagogy += 0.5;

  // Ethics Keywords
  const ethicsKeywords = /(privacy|bias|legal|copyright|data|risk|safety|harm|policy|regulation|jailbreak|attack|hack|discrimination|fake|deepfake|propaganda|manipulate|cheat|plagiarism|violence|porn|adult|nsfw|隐私|偏见|法律|版权|数据|风险|安全|合规|越狱|攻击|黑客|歧视|暴力|色情|违规|造假|深度伪造|宣传|操纵|作弊|抄袭)/i;
  if (ethicsKeywords.test(lowerText)) scores.ethics += 1;

  // Decision Logic
  let maxScore = -1;
  let bestAgent = 'general';

  for (const [agent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestAgent = agent;
    }
  }
  
  // Strategy from oldCoder: If no keywords matched, analyze context length.
  if (maxScore === 0) {
    if (text.length > 10) {
      return 'pedagogy'; // Default to Pedagogy for general inquiries in an educational tool
    }
    return 'general';
  }
  
  // Standard Tie-breaking for positive scores
  if (maxScore > 0) {
    if (scores.ethics >= scores.tech && scores.ethics >= scores.pedagogy && scores.ethics > 0) return 'ethics';
    if (scores.pedagogy >= scores.tech && scores.pedagogy > 0) return 'pedagogy';
    if (scores.tech > 0) return 'tech';
  }

  return bestAgent;
}
