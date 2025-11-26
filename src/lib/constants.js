import { 
  GlobeAltIcon, 
  DocumentMagnifyingGlassIcon, 
  CalendarDaysIcon, 
  EnvelopeIcon, 
  ChatBubbleBottomCenterTextIcon, 
  ShieldCheckIcon, 
  CommandLineIcon, 
  CodeBracketIcon, 
  ArrowPathIcon, 
  TagIcon, 
  AcademicCapIcon, 
  MapIcon, 
  VideoCameraIcon 
} from '@heroicons/react/24/outline';

// === [修改] 强制使用 IPv4 地址，避免 localhost 解析问题 ===
export const API_URL = "http://127.0.0.1:8000";

// === 完整服务商配置 ===
export const PROVIDERS = {
    "deepseek": { name: "DeepSeek (官方)", baseUrl: "https://api.deepseek.com", defaultModel: "deepseek-chat" },
    "openrouter": { name: "OpenRouter (聚合)", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "google/gemini-pro-1.5" },
    "gemini": { name: "Google Gemini (OpenAI兼容)", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", defaultModel: "gemini-2.0-flash" },
    "openai": { name: "OpenAI (官方/代理)", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o" },
    "siliconflow": { name: "硅基流动 (SiliconFlow)", baseUrl: "https://api.siliconflow.cn/v1", defaultModel: "deepseek-ai/DeepSeek-V3" },
    "moonshot": { name: "月之暗面 (Kimi)", baseUrl: "https://api.moonshot.cn/v1", defaultModel: "moonshot-v1-8k" },
    "custom": { name: "自定义 (Custom)", baseUrl: "", defaultModel: "" }
};

// === 完整 AI 工具列表 ===
export const AI_TOOLS = [
    { id: 'translate', name: '智能翻译 & 润色', icon: GlobeAltIcon, desc: '多语言互译与润色，支持学术、商务、口语等多种风格切换。', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400',Pcrompt: "DYNAMIC", inputType: 'text' },
    { id: 'summary', name: '一键摘要', icon: DocumentMagnifyingGlassIcon, desc: '快速提取长文核心观点，生成简洁摘要。', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400', prompt: "你是一个专业的摘要助手。请对用户提供的文本进行深度分析，提取核心观点，并生成一份结构清晰、简明扼要的摘要。", inputType: 'text' },
    { id: 'report', name: '周报/日报生成', icon: CalendarDaysIcon, desc: '输入碎片化工作内容，自动生成专业周报。', color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400', prompt: "你是一个职场写作专家。请根据用户输入的碎片化工作内容，扩展成一份专业的周报。", inputType: 'text' },
    { id: 'email', name: '高情商邮件', icon: EnvelopeIcon, desc: '输入意图，生成得体、专业的商务邮件。', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400', prompt: "你是一个商务沟通专家。撰写一封得体、高情商、专业的邮件。", inputType: 'text' },
    { id: 'social', name: '社交动态文案', icon: ChatBubbleBottomCenterTextIcon, desc: '朋友圈/Twitter风格，自然不做作。', color: 'text-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-400', prompt: "你是一个社交媒体文案专家。创作一条适合发在微信朋友圈或 Twitter 的文案。", inputType: 'text' },
    { id: 'humanize', name: '降重 / 去 AI 味', icon: ShieldCheckIcon, desc: '改写文本，降低 AIGC 检出率，语气更自然。', color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400', prompt: "你是一个资深的文字编辑。请改写用户提供的文本，降低 AIGC 检测率，使其读起来更像人类自然的表达。", inputType: 'text' },
    { id: 'code_explain', name: '代码解释器', icon: CommandLineIcon, desc: '详细分析代码逻辑、功能及潜在 Bug。', color: 'text-pink-600 bg-pink-50 dark:bg-pink-900/30 dark:text-pink-400', prompt: "你是一个资深程序员。请详细解释用户提供的代码。", inputType: 'text' },
    { id: 'regex', name: '正则生成器', icon: CodeBracketIcon, desc: '描述需求，自动生成正则表达式及示例。', color: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400', prompt: "你是一个正则专家。请根据用户的自然语言描述，生成对应的正则表达式。", inputType: 'text' },
    { id: 'formatter', name: '数据格式化', icon: ArrowPathIcon, desc: '将非结构化文本转换为 JSON 或 SQL。', color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30 dark:text-cyan-400', prompt: "你是一个数据处理专家。请将文本转换为标准的 JSON 格式或 SQL 语句。", inputType: 'text' },
    { id: 'naming', name: '变量命名助手', icon: TagIcon, desc: '提供 5 个优雅的代码命名建议。', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400', prompt: "你是一个资深架构师。给出 5 个优雅的代码命名建议。", inputType: 'text' },
    { id: 'eli5', name: 'ELI5 (通俗解释)', icon: AcademicCapIcon, desc: '用五岁孩子能听懂的话解释复杂概念。', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400', prompt: "你是一个科普老师。请用“像给五岁孩子讲故事”一样的简单语言解释概念。", inputType: 'text' },
    { id: 'mindmap', name: '思维导图生成', icon: MapIcon, desc: '整理文章逻辑，生成 Mermaid 思维导图代码。', color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-400', prompt: "你是一个逻辑整理专家。整理成 Mermaid.js 的思维导图格式代码。", inputType: 'text' },
    { id: 'subtitle', name: '视频转字幕 (.SRT)', icon: VideoCameraIcon, desc: '上传视频/音频，生成带时间轴的 SRT 字幕。', color: 'text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-900/30 dark:text-fuchsia-400', prompt: "", inputType: 'video' }
];
