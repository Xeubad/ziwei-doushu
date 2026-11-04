/**
 * lib/ai/body —— 请求体安全读取
 *
 * req.json() 会把整个 body 读进内存再 parse；超大 body 既是内存压力，
 * 也可能绕过字段级校验把超大 messages/chart 塞给上游烧 token。
 * 这里先按字节截断读取，超限直接判 invalid-request。
 */

import type { NextRequest } from 'next/server';

/** AI 接口请求体上限：命盘 JSON ~8KB，40 条消息 ×4000 字 ~160KB，留余量 */
export const MAX_BODY_BYTES = 256 * 1024;

type ReadResult =
  | { ok: true; body: unknown }
  | { ok: false; tooLarge: boolean };

export async function readJsonBody(req: NextRequest, maxBytes = MAX_BODY_BYTES): Promise<ReadResult> {
  // 声明长度超限直接拒（不发 body 时 header 可能缺失，继续走流式检查）
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, tooLarge: true };
  }

  let text: string;
  if (req.body) {
    // 按上限截断读取：超限即拒，不把整个 body 拉进内存
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    let tooLarge = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        tooLarge = true;
        await reader.cancel().catch(() => {});
        break;
      }
      chunks.push(value);
    }
    if (tooLarge) return { ok: false, tooLarge: true };
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
    text = new TextDecoder().decode(bytes);
  } else {
    text = await req.text();
    if (text.length > maxBytes) return { ok: false, tooLarge: true };
  }

  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, tooLarge: false };
  }
}
