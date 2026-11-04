/**
 * POST /api/heming —— 双人合盘 AI 分析（流式）
 *
 * 请求：{ chartA: ZiweiChart, chartB: ZiweiChart, question?: string }
 * 响应：同 /api/interpret —— 逐行 `data: {"delta":{"text":...}}\n`，`data: [DONE]\n` 收尾
 *
 * 无多轮历史：前端每次追问都是无状态单次调用（question 可选，缺省即完整合盘分析）。
 * 错误语义与 /api/interpret 一致（400 / 503 / 502）。
 */

import { NextRequest } from 'next/server';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { resolveAiConfig } from '@/lib/ai/config';
import { guardAiRequest } from '@/lib/ai/guard';
import { readJsonBody } from '@/lib/ai/body';
import { buildHemingSystemPrompt } from '@/lib/ai/prompts';
import { streamChatCompletion, type ChatMessage } from '@/lib/ai/sse';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_QUESTION_CHARS = 1000;

function isZiweiChart(v: unknown): v is ZiweiChart {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  return Array.isArray(c.palaces) && c.palaces.length === 12
    && typeof c.birthInfo === 'object' && c.birthInfo !== null
    && Array.isArray(c.daXians);
}

export async function POST(req: NextRequest) {
  // 访问口令 + 速率限制（401 / 429）
  const denied = guardAiRequest(req, 'heming');
  if (denied) return denied;

  const parsed = await readJsonBody(req);
  if (!parsed.ok) {
    return Response.json(
      { error: 'invalid-request', detail: parsed.tooLarge ? '请求体过大' : 'JSON 不合法' },
      { status: 400 },
    );
  }
  const body = parsed.body;

  const { chartA, chartB, question } = (body ?? {}) as {
    chartA?: unknown; chartB?: unknown; question?: unknown;
  };
  if (!isZiweiChart(chartA) || !isZiweiChart(chartB)) {
    return Response.json({ error: 'invalid-request', detail: 'chart 不合法' }, { status: 400 });
  }
  if (question !== undefined
      && (typeof question !== 'string' || question.length > MAX_QUESTION_CHARS)) {
    return Response.json({ error: 'invalid-request', detail: 'question 不合法' }, { status: 400 });
  }

  const config = resolveAiConfig();
  if (!config) {
    return Response.json({ error: 'ai-not-configured' }, { status: 503 });
  }

  let systemPrompt: string;
  try {
    systemPrompt = buildHemingSystemPrompt(chartA, chartB);
  } catch (err) {
    console.error('[api/heming] prompt build error:', err);
    return Response.json({ error: 'invalid-request', detail: 'chart 数据不完整' }, { status: 400 });
  }

  const chatMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: question?.trim()
        ? question.trim()
        : '请给出甲乙双方的完整合盘分析。',
    },
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
    console.error('[api/heming] upstream error:', err);
    return Response.json({ error: 'upstream-error' }, { status: 502 });
  }
}
