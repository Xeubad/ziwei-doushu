/**
 * lib/ai/client —— 前端流式调用 /api/interpret、/api/heming 的共享客户端
 *
 * 统一三处（ChatPanel / InsightPanel / heming 页）的 SSE 解析与错误语义：
 *   逐行 `data: {"delta":{"text":...}}\n`，`data: [DONE]\n` 收尾。
 */

export type AiErrorKind =
  | 'api-missing'      // 404：部署里没有 app/api 路由
  | 'not-configured'   // 503 ai-not-configured：没配模型 API Key
  | 'upstream'         // 502：上游模型接口失败
  | 'unauthorized'     // 401 ai-unauthorized：访问口令缺失或错误
  | 'rate-limited'     // 429 rate-limited：触发速率限制
  | 'network'          // 请求本身失败（断网、超时）
  | 'unknown';

export class AiStreamError extends Error {
  kind: AiErrorKind;
  /** 429 时服务端建议的等待秒数 */
  retryAfter?: number;
  constructor(kind: AiErrorKind, message?: string, retryAfter?: number) {
    super(message ?? kind);
    this.kind = kind;
    this.retryAfter = retryAfter;
  }
}

/** 错误类型 → 面向用户的文案（endpoint 仅用于 api-missing 提示） */
export function aiErrorMessage(kind: AiErrorKind, endpoint = '/api/interpret', retryAfter?: number): string {
  switch (kind) {
    case 'api-missing':
      return `未找到 AI 接口（${endpoint}）。部署时请确保包含 app/api 路由，详见 README「快速开始」。`;
    case 'not-configured':
      return 'AI 服务未配置模型 API Key。在 .env.local 里填好（参考 .env.example）并重启服务即可启用；排盘本身不需要任何 API Key。';
    case 'unauthorized':
      return 'AI 接口访问口令错误。刷新页面重新输入，或联系站长获取口令。';
    case 'rate-limited':
      return `请求太频繁，触发了速率限制${retryAfter ? `，请 ${retryAfter} 秒后再试` : '，请稍后再试'}。`;
    case 'upstream':
      return '模型服务暂时不可用，请稍后重试。';
    case 'network':
      return '网络异常，请求中断，请重试。';
    default:
      return '解读失败，请稍后重试。';
  }
}

// ── 访问口令：优先 localStorage（用户输入），其次构建期配置 ──
const TOKEN_KEY = 'ziwei-ai-token';

function getAiToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(TOKEN_KEY) ?? process.env.NEXT_PUBLIC_AI_ACCESS_TOKEN ?? '';
  } catch {
    return process.env.NEXT_PUBLIC_AI_ACCESS_TOKEN ?? '';
  }
}

function setAiToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch { /* 隐私模式等场景忽略 */ }
}

interface StreamAiTextOptions {
  url: string;
  body: unknown;
  /** 每收到一段增量调用一次，参数是「到目前为止的完整文本」 */
  onText: (fullText: string) => void;
  /** 可选：中断请求 */
  signal?: AbortSignal;
}

/** 单次请求（不含口令重试逻辑） */
async function requestOnce(
  url: string,
  body: unknown,
  onText: (fullText: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  const token = getAiToken();
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'x-ai-token': token } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw new AiStreamError('unknown', 'aborted');
    throw new AiStreamError('network', e instanceof Error ? e.message : undefined);
  }

  if (res.status === 404) throw new AiStreamError('api-missing');
  if (!res.ok) {
    let kind: AiErrorKind = 'unknown';
    let retryAfter: number | undefined;
    try {
      const data = await res.json();
      if (data?.error === 'ai-not-configured') kind = 'not-configured';
      else if (data?.error === 'upstream-error') kind = 'upstream';
      else if (data?.error === 'ai-unauthorized') kind = 'unauthorized';
      else if (data?.error === 'rate-limited') {
        kind = 'rate-limited';
        retryAfter = typeof data?.retryAfter === 'number' ? data.retryAfter : undefined;
      }
    } catch { /* 非 JSON 错误体 */ }
    if (kind === 'rate-limited') throw new AiStreamError(kind, undefined, retryAfter);
    throw new AiStreamError(kind);
  }
  if (!res.body) throw new AiStreamError('unknown', '无响应流');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const rawLine of lines) {
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return;
      try {
        const delta = JSON.parse(data).delta?.text ?? '';
        if (delta) {
          fullText += delta;
          onText(fullText);
        }
      } catch { /* 跳过非 JSON 行 */ }
    }
  }
}

/** 调用 AI 流式接口；失败抛 AiStreamError（.kind 区分错误语义） */
export async function streamAiText({ url, body, onText, signal }: StreamAiTextOptions): Promise<void> {
  try {
    await requestOnce(url, body, onText, signal);
  } catch (e) {
    // 首次因口令被拒：向用户要口令，存好后自动重试一次
    if (e instanceof AiStreamError && e.kind === 'unauthorized' && !getAiToken()) {
      const input = window.prompt('本站 AI 接口已启用访问口令，请输入：');
      if (input && input.trim()) {
        setAiToken(input.trim());
        await requestOnce(url, body, onText, signal);
        return;
      }
    }
    throw e;
  }
}
