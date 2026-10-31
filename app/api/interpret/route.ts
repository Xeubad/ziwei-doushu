/**
 * POST /api/interpret —— AI 命盘解读（流式）
 *
 * 请求：{ chart: ZiweiChart, messages: [{ role, content }] }
 * 响应：逐行 `data: {"delta":{"text":...}}\n`，`data: [DONE]\n` 收尾
 *       （与 ChatPanel / InsightPanel 的解析约定一致）
 *
 * 错误语义：
 *   400 invalid-request     请求体不合法
 *   503 ai-not-configured   未配置模型 API Key（区别于 404「接口不存在」）
 *   502 upstream-error      上游模型接口失败
 */

import { NextRequest } from 'next/server';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { resolveAiConfig } from '@/lib/ai/config';
import { guardAiRequest } from '@/lib/ai/guard';
import { buildInterpretSystemPrompt } from '@/lib/ai/prompts';
import { streamChatCompletion, type ChatMessage } from '@/lib/ai/sse';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_MESSAGES = 40;
const MAX_CONTENT_CHARS = 4000;

function isChatMessage(v: unknown): v is ChatMessage {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  return (m.role === 'user' || m.role === 'assistant' || m.role === 'system')
    && typeof m.content === 'string';
}

/** 命盘是客户端生成的，做最小结构校验，防脏数据进 prompt */
function isZiweiChart(v: unknown): v is ZiweiChart {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  return Array.isArray(c.palaces) && c.palaces.length === 12
    && typeof c.birthInfo === 'object' && c.birthInfo !== null
    && Array.isArray(c.daXians);
}

export async function POST(req: NextRequest) {
  // 访问口令 + 速率限制（401 / 429）
  const denied = guardAiRequest(req, 'interpret');
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid-request' }, { status: 400 });
  }

  const { chart, messages } = (body ?? {}) as { chart?: unknown; messages?: unknown };
  if (!isZiweiChart(chart)) {
    return Response.json({ error: 'invalid-request', detail: 'chart 不合法' }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES
      || !messages.every(m => isChatMessage(m) && m.content.length <= MAX_CONTENT_CHARS)) {
    return Response.json({ error: 'invalid-request', detail: 'messages 不合法' }, { status: 400 });
  }

  const config = resolveAiConfig();
  if (!config) {
    return Response.json({ error: 'ai-not-configured' }, { status: 503 });
  }

  let systemPrompt: string;
  try {
    systemPrompt = buildInterpretSystemPrompt(chart);
  } catch (err) {
    console.error('[api/interpret] prompt build error:', err);
    return Response.json({ error: 'invalid-request', detail: 'chart 数据不完整' }, { status: 400 });
  }

  const chatMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  try {
    const stream = await streamChatCompletion(config, chatMessages);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('[api/interpret] upstream error:', err);
    return Response.json({ error: 'upstream-error' }, { status: 502 });
  }
}
