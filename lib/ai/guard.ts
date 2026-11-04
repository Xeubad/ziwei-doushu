/**
 * lib/ai/guard —— AI 接口的轻量防护（访问口令 + 速率限制）
 *
 * 定位：防止 API Key 被公网陌生人刷爆，不追求企业级安全（多实例部署时
 * 内存限流是按实例独立的；要全局限流请换 Redis 等共享存储）。
 *
 * 访问口令（可选）：设置 AI_ACCESS_TOKEN 后，请求必须携带任一：
 *   - `x-ai-token: <token>` 头
 *   - `Authorization: Bearer <token>` 头
 * 网页端在收到 401 时会弹窗向用户要口令，保存到 localStorage 后重试。
 *
 * 速率限制（默认开启）：按 IP 的 60s 滑动窗口计数，超限返回 429 + Retry-After。
 */

import type { NextRequest } from 'next/server';

/** ip → 最近一分钟内的请求时间戳 */
const buckets = new Map<string, number[]>();

const WINDOW_MS = 60_000;

/** interpret 话题/宫位点击可能连发，默认宽松一些 */
export const DEFAULT_RATE_LIMIT = {
  interpret: 20,
  heming: 10,
} as const;

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'local';
}

function checkToken(req: NextRequest): Response | null {
  const expected = (process.env.AI_ACCESS_TOKEN ?? '').trim();
  if (!expected) return null; // 未设置口令 = 不启用该层防护
  const provided =
    req.headers.get('x-ai-token')
    ?? req.headers.get('authorization')?.replace(/^bearer\s+/i, '').trim()
    ?? '';
  if (provided !== expected) {
    return Response.json({ error: 'ai-unauthorized' }, { status: 401 });
  }
  return null;
}

function checkRateLimit(req: NextRequest, fallbackPerMinute: number): Response | null {
  // 注意：Number('') === 0，未设置的环境变量必须先判空，否则会被当成「0=不限速」
  const raw = (process.env.AI_RATE_LIMIT_PER_MIN ?? '').trim();
  const configured = raw === '' ? NaN : Number(raw);
  const perMinute = Number.isFinite(configured) && configured >= 0
    ? configured
    : fallbackPerMinute;
  if (perMinute === 0) return null; // 显式配 0 = 不限速

  const now = Date.now();
  const ip = clientIp(req);
  const hits = (buckets.get(ip) ?? []).filter(t => now - t < WINDOW_MS);

  if (hits.length >= perMinute) {
    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - hits[0])) / 1000));
    buckets.set(ip, hits);
    return Response.json(
      { error: 'rate-limited', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  hits.push(now);
  buckets.set(ip, hits);

  // 防内存膨胀：桶数超阈值时清掉已过期的
  if (buckets.size > 2000) {
    for (const [k, v] of buckets) {
      if (v.every(t => now - t >= WINDOW_MS)) buckets.delete(k);
    }
  }
  return null;
}

/**
 * 依次校验访问口令与速率限制。
 * 返回 null 表示放行；返回 Response 表示拒绝（401 / 429），调用方直接 return。
 */
export function guardAiRequest(
  req: NextRequest,
  kind: keyof typeof DEFAULT_RATE_LIMIT,
): Response | null {
  return checkToken(req) ?? checkRateLimit(req, DEFAULT_RATE_LIMIT[kind]);
}
