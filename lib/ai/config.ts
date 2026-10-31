/**
 * lib/ai/config —— OpenAI 兼容协议的模型配置解析
 *
 * 一套配置打通任意 OpenAI 兼容端点（DeepSeek / MiMo / OpenAI / 自建网关）：
 *   AI_PROVIDER=deepseek  → DEEPSEEK_API_KEY（可选 DEEPSEEK_BASE_URL / DEEPSEEK_MODEL）
 *   AI_PROVIDER=mimo      → MIMO_API_KEY + MIMO_BASE_URL + MIMO_MODEL
 *   AI_PROVIDER=openai    → OPENAI_API_KEY（可选 OPENAI_BASE_URL / OPENAI_MODEL）
 *   AI_PROVIDER=custom    → AI_BASE_URL + AI_API_KEY + AI_MODEL（也作兜底）
 *
 * 未配置时 resolveAiConfig() 返回 null，API 路由返回 503（而非 404 —— 404
 * 在前端语义里是「开源版不含接口」，两者要区分开）。
 */

export interface AiConfig {
  /** OpenAI 兼容端点前缀，不带尾斜杠，如 https://api.deepseek.com/v1 */
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

/** 每家预设：默认端点 / Key 环境变量 / 模型环境变量 / 默认模型 */
interface ProviderPreset {
  baseUrl: string;
  keyEnv: string;
  modelEnv: string;
  defaultModel: string;
  /** 是否要求显式提供 BASE_URL（自建网关必须说清楚端点） */
  baseUrlEnv?: string;
  baseUrlRequired?: boolean;
}

const PRESETS: Record<string, ProviderPreset> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    keyEnv: 'DEEPSEEK_API_KEY',
    modelEnv: 'DEEPSEEK_MODEL',
    defaultModel: 'deepseek-chat',
    baseUrlEnv: 'DEEPSEEK_BASE_URL',
  },
  mimo: {
    baseUrl: '',
    keyEnv: 'MIMO_API_KEY',
    modelEnv: 'MIMO_MODEL',
    defaultModel: '',
    baseUrlEnv: 'MIMO_BASE_URL',
    baseUrlRequired: true,
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    keyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    defaultModel: 'gpt-4o-mini',
    baseUrlEnv: 'OPENAI_BASE_URL',
  },
  custom: {
    baseUrl: '',
    keyEnv: 'AI_API_KEY',
    modelEnv: 'AI_MODEL',
    defaultModel: '',
    baseUrlEnv: 'AI_BASE_URL',
    baseUrlRequired: true,
  },
};

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * 解析当前环境的 AI 配置。
 * 返回 null 表示未配置（调用方应返回 503 并给出可读错误，而不是让前端误判为 404）。
 */
export function resolveAiConfig(): AiConfig | null {
  const provider = (process.env.AI_PROVIDER ?? '').trim().toLowerCase();
  const preset = provider ? PRESETS[provider] : undefined;

  // AI_PROVIDER 显式指定了，但名字不认识 → 视为配置错误，不静默兜底
  if (provider && !preset) return null;

  // 未指定 provider 时按 deepseek → custom 的顺序自动探测
  const candidates: ProviderPreset[] = preset ? [preset] : [PRESETS.deepseek, PRESETS.custom];

  for (const p of candidates) {
    const apiKey = (process.env[p.keyEnv] ?? '').trim();
    // 占位值（如 .env.example 里的 your-xxx）视为未配置，提示比上游 401 清楚
    if (!apiKey || apiKey.startsWith('your-')) continue;

    const baseUrl = trimSlash(
      (p.baseUrlEnv ? (process.env[p.baseUrlEnv] ?? '').trim() : '') || p.baseUrl
    );
    if (!baseUrl) continue; // baseUrlRequired 但没配端点

    const model = (process.env[p.modelEnv] ?? '').trim() || p.defaultModel;
    if (!model) continue; // 没有可用模型名

    return {
      baseUrl,
      apiKey,
      model,
      temperature: Number(process.env.AI_TEMPERATURE ?? '') || 0.8,
      maxTokens: Number(process.env.AI_MAX_TOKENS ?? '') || 2048,
    };
  }
  return null;
}

/** 把上游（OpenAI 兼容）错误响应整理成一句话，便于打进日志 / 返回给前端调试 */
export async function describeUpstreamError(res: Response): Promise<string> {
  let detail = '';
  try {
    detail = (await res.text()).slice(0, 500);
  } catch { /* 响应体读不出来就算了 */ }
  return `上游模型接口返回 ${res.status}${detail ? `：${detail}` : ''}`;
}
