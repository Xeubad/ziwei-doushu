/**
 * AI 防护层回归测试：lib/ai/guard（口令 + 限流）与 lib/ai/body（请求体上限）
 * 运行：npx tsx scripts/regression/ai-guard.test.ts
 *
 * 注意：guard 的限流桶是模块级 Map，各用例用不同 IP 避免互相污染。
 */

import type { NextRequest } from 'next/server';
import { guardAiRequest } from '../../lib/ai/guard';
import { readJsonBody } from '../../lib/ai/body';

let passed = 0;
let failed = 0;

function assert(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ ${name}`, detail ?? ''); }
}

function fakeReq(headers: Record<string, string>, body?: ReadableStream<Uint8Array>): NextRequest {
  return { headers: new Headers(headers), body: body ?? null } as unknown as NextRequest;
}

function streamOf(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } });
}

let ipSeq = 0;
function freshIp(): string { return `10.0.0.${++ipSeq}`; }

async function main() {
  const savedToken = process.env.AI_ACCESS_TOKEN;
  const savedRate = process.env.AI_RATE_LIMIT_PER_MIN;

  try {
    // ── 访问口令 ──
    console.log('[ai-guard] 访问口令');
    delete process.env.AI_ACCESS_TOKEN;
    assert('未设口令时放行', guardAiRequest(fakeReq({ 'x-forwarded-for': freshIp() }), 'interpret') === null);

    process.env.AI_ACCESS_TOKEN = 'secret-token';
    const unauth = guardAiRequest(fakeReq({ 'x-forwarded-for': freshIp() }), 'interpret');
    assert('缺口令 → 401', unauth?.status === 401);
    assert('401 语义为 ai-unauthorized', (await unauth!.json() as { error: string }).error === 'ai-unauthorized');

    const wrong = guardAiRequest(fakeReq({ 'x-forwarded-for': freshIp(), 'x-ai-token': 'bad' }), 'interpret');
    assert('错误口令 → 401', wrong?.status === 401);

    assert('x-ai-token 正确 → 放行',
      guardAiRequest(fakeReq({ 'x-forwarded-for': freshIp(), 'x-ai-token': 'secret-token' }), 'interpret') === null);
    assert('Bearer 头正确 → 放行',
      guardAiRequest(fakeReq({ 'x-forwarded-for': freshIp(), authorization: 'Bearer secret-token' }), 'interpret') === null);

    // ── 速率限制 ──
    console.log('[ai-guard] 速率限制');
    delete process.env.AI_ACCESS_TOKEN;
    delete process.env.AI_RATE_LIMIT_PER_MIN;

    const ipA = freshIp();
    let limited: Response | null = null;
    for (let i = 0; i < 21; i++) {
      limited = guardAiRequest(fakeReq({ 'x-forwarded-for': ipA }), 'interpret');
    }
    assert('interpret 默认 20/分：第 21 次 429', limited?.status === 429);
    const limitedBody = await limited!.json() as { error: string; retryAfter: number };
    assert('429 语义为 rate-limited', limitedBody.error === 'rate-limited');
    assert('429 带 retryAfter > 0', limitedBody.retryAfter > 0);
    assert('429 带 Retry-After 头', Number(limited!.headers.get('retry-after')) > 0);

    const ipB = freshIp();
    let hemingLimited: Response | null = null;
    for (let i = 0; i < 11; i++) {
      hemingLimited = guardAiRequest(fakeReq({ 'x-forwarded-for': ipB }), 'heming');
    }
    assert('heming 默认 10/分：第 11 次 429', hemingLimited?.status === 429);

    const ipC = freshIp();
    assert('不同 IP 计数独立', guardAiRequest(fakeReq({ 'x-forwarded-for': ipC }), 'heming') === null);

    process.env.AI_RATE_LIMIT_PER_MIN = '0';
    const ipD = freshIp();
    let last: Response | null = null;
    for (let i = 0; i < 30; i++) last = guardAiRequest(fakeReq({ 'x-forwarded-for': ipD }), 'heming');
    assert('AI_RATE_LIMIT_PER_MIN=0 时不限速', last === null);
    delete process.env.AI_RATE_LIMIT_PER_MIN;

    const ipE = '192.168.9.9';
    let xRealIpLimited: Response | null = null;
    for (let i = 0; i < 11; i++) {
      xRealIpLimited = guardAiRequest(fakeReq({ 'x-real-ip': ipE }), 'heming');
    }
    assert('无 XFF 时按 x-real-ip 限流', xRealIpLimited?.status === 429);

    // ── 请求体上限 ──
    console.log('[ai-body] 请求体上限');
    const ok = await readJsonBody(fakeReq({}, streamOf('{"a":1}')));
    assert('正常 JSON 解析', ok.ok && (ok.body as { a: number }).a === 1);

    const bad = await readJsonBody(fakeReq({}, streamOf('not-json')));
    assert('非法 JSON → ok=false', !bad.ok && !bad.tooLarge);

    const huge = await readJsonBody(fakeReq({}, streamOf('x'.repeat(300 * 1024))), 1000);
    assert('流式超限 → tooLarge', !huge.ok && huge.tooLarge);

    const declared = await readJsonBody(
      fakeReq({ 'content-length': '99999999' }),
      1000,
    );
    assert('Content-Length 超限直接拒', !declared.ok && declared.tooLarge);

    const boundary = await readJsonBody(fakeReq({}, streamOf('{"k":"' + 'v'.repeat(900) + '"}')), 1000);
    assert('上限内正常解析', boundary.ok);

    console.log(`\n[ai-guard] ${passed} 通过，${failed} 失败`);
    if (failed > 0) process.exit(1);
  } finally {
    if (savedToken === undefined) delete process.env.AI_ACCESS_TOKEN;
    else process.env.AI_ACCESS_TOKEN = savedToken;
    if (savedRate === undefined) delete process.env.AI_RATE_LIMIT_PER_MIN;
    else process.env.AI_RATE_LIMIT_PER_MIN = savedRate;
  }
}

main().catch(e => { console.error(e); process.exit(1); });
