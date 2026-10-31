/**
 * lib/ai/sse —— OpenAI 兼容 chat/completions → 前端约定的文本流
 *
 * 前端约定（ChatPanel / InsightPanel / heming 页共用）：
 *   逐行 `data: {"delta":{"text":"增量文本"}}\n`，以 `data: [DONE]\n` 收尾。
 *   不是标准 SSE 的 event: 多行 data 规范，只认「一行一个 data: JSON」。
 */

import type { AiConfig } from './config';
import { describeUpstreamError } from './config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const encoder = new TextEncoder();

/** 一行 `data: ...`（含换行） */
function dataLine(payload: string): Uint8Array {
  return encoder.encode(`data: ${payload}\n`);
}

/** 前端协议的一段增量文本 */
function deltaLine(text: string): Uint8Array {
  return dataLine(JSON.stringify({ delta: { text } }));
}

/**
 * 调用 OpenAI 兼容端点并把流式输出转成前端协议。
 * 上游返回非 2xx 时抛出带可读信息的 Error（调用方转成 502）。
 */
export async function streamChatCompletion(
  config: AiConfig,
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(await describeUpstreamError(res));
  }

  const upstream = res.body;
  const reader = upstream.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(dataLine(JSON.stringify({ delta: { text: '' } }))); // 让前端立刻建立流
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // 上游 SSE 以空行分隔事件；按行消费，保留未完整的尾巴
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue; // 结束符统一由我们补
            try {
              const parsed = JSON.parse(data);
              const text =
                parsed.choices?.[0]?.delta?.content ??
                parsed.delta?.text ?? // 兼容个别网关直接转发自定义形状
                '';
              if (text) controller.enqueue(deltaLine(text));
            } catch { /* 非 JSON 行（注释、心跳）跳过 */ }
          }
        }
        controller.enqueue(dataLine('[DONE]'));
        controller.close();
      } catch (err) {
        // 流中途断掉：把已生成内容保留在前端，另送一条提示后收尾
        controller.enqueue(deltaLine('\n\n（生成中断，请重试）'));
        controller.enqueue(dataLine('[DONE]'));
        controller.close();
        console.error('[ai/sse] stream interrupted:', err);
      } finally {
        reader.releaseLock();
      }
    },
    cancel() {
      // 用户关页面 / 前端 abort：顺手取消上游请求
      reader.cancel().catch(() => {});
    },
  });
}
