/**
 * lib/ziwei/share-codec —— 命盘分享码的编解码
 *
 * 分享码 = 生辰（用于确定性重建盘面）+ AI 分析快照（发起人已生成的解读）。
 * **不含提问记录**（隐私），也不含对话能力（接收方只读）。
 *
 * 格式：
 *   v1（旧码，仅解码兼容）：`1.<base64url(JSON)>`
 *   v2（当前）：            `2.<base64url(gzip(JSON))>.<crc32hex>`
 *     { v: 2, b: { y, m, d, h, g }, a: ["分析文本", ...] }
 *     - b：最终 BirthInfo 的紧凑形式（h 已含真太阳时校正，g = m/f）
 *     - a：assistant 分析内容，最多 6 条、单条 4000 字
 *     - crc32 校验的是 gzip 字节流，防传输/粘贴损坏（非防伪签名：
 *       校验位本身也可伪造，要防伪需要服务端 HMAC，Demo 不做）
 *   中文分析 gzip 压缩率约 3-4 倍：1 条分析 v1 约 3.5KB → v2 约 1KB。
 *
 * 兼容性：
 *   - 解码同时接受 v1 与 v2；encodeShareCode 始终产出 v2
 *     （老环境无 CompressionStream 时回退产出 v1）。
 *   - 编解码均为 async（CompressionStream / DecompressionStream 是异步 API），
 *     浏览器与 Node ≥18 通用。
 */

import type { BirthInfo } from './types';

const PREFIX_V1 = '1.';
const PREFIX_V2 = '2.';
const MAX_ANALYSES = 6;
const MAX_ANALYSIS_CHARS = 4000;
const MAX_CODE_LENGTH = 24_000;
/** 解压后 JSON 上限：gzip 炸弹防御（正常 payload < 30KB） */
const MAX_DECOMPRESSED = 256 * 1024;

export interface SharePayload {
  /** 用于 generateChart 的最终生辰（已含晚子时/真太阳时校正） */
  birthInfo: BirthInfo;
  /** AI 分析快照（assistant 内容，不含用户提问） */
  analyses: string[];
}

interface ShareBirth {
  y: number;
  m: number;
  d: number;
  h: number;
  g: 'm' | 'f';
}

// ── CRC32（完整性校验）────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── 字节 <-> base64url（UTF-8 安全）───────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toUrlSafe(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromUrlSafe(s: string): string {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  return b64;
}

// ── gzip（CompressionStream / DecompressionStream）────────

async function gzipCompress(text: string): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function gzipDecompress(bytes: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  const stream = new Blob([bytes.buffer as ArrayBuffer])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_DECOMPRESSED) {
      await reader.cancel().catch(() => {});
      return null; // 解压超限：疑似 gzip 炸弹
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return new TextDecoder().decode(out);
}

// ── 编码 ──────────────────────────────────────────────────

function buildPayload({ birthInfo, analyses }: SharePayload): string {
  const birth: ShareBirth = {
    y: birthInfo.year,
    m: birthInfo.month,
    d: birthInfo.day,
    h: birthInfo.hour,
    g: birthInfo.gender === 'male' ? 'm' : 'f',
  };
  const safeAnalyses = analyses
    .filter(t => typeof t === 'string' && t.trim().length > 0)
    .slice(0, MAX_ANALYSES)
    .map(t => t.slice(0, MAX_ANALYSIS_CHARS));
  return JSON.stringify({ v: 2, b: birth, a: safeAnalyses });
}

export async function encodeShareCode(payload: SharePayload): Promise<string> {
  const json = buildPayload(payload);
  const compressed = await gzipCompress(json);
  if (compressed) {
    return `${PREFIX_V2}${toUrlSafe(bytesToBase64(compressed))}.${crc32(compressed).toString(16)}`;
  }
  // 老环境兜底：无 CompressionStream 时产出 v1（同样可被解码）
  const utf8 = new TextEncoder().encode(json.replace('"v":2', '"v":1'));
  return PREFIX_V1 + toUrlSafe(bytesToBase64(utf8));
}

// ── 解码 ──────────────────────────────────────────────────

/** 从用户粘贴的内容里提取分享码（容忍整条 URL、空白、换行） */
function extractCode(input: string): string {
  const clean = input.trim();
  // 直接粘贴了完整链接：取 d= 参数
  const urlMatch = clean.match(/[?&]d=([^&\s]+)/);
  if (urlMatch) return decodeURIComponent(urlMatch[1]).trim();
  return clean.replace(/\s+/g, '');
}

/** 字段校验：ShareBirth + analyses → SharePayload（v1/v2 共用） */
function toPayload(data: unknown): SharePayload | null {
  if (typeof data !== 'object' || data === null) return null;
  const { b, a } = data as { b?: unknown; a?: unknown };
  if (typeof b !== 'object' || b === null) return null;
  const raw = b as Record<string, unknown>;

  const y = Number(raw.y);
  const m = Number(raw.m);
  const d = Number(raw.d);
  const h = Number(raw.h);
  const g = raw.g === 'f' ? 'female' : raw.g === 'm' ? 'male' : null;

  if (!g) return null;
  if (!Number.isInteger(y) || y < 1900 || y > 2100) return null;
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  if (!Number.isInteger(d) || d < 1 || d > 31) return null;
  if (!Number.isInteger(h) || h < 0 || h > 11) return null;

  // 日期必须真实存在（拒绝 2 月 30 日之类的伪造值）
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;

  const analyses = Array.isArray(a)
    ? a
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .slice(0, MAX_ANALYSES)
        .map(t => t.slice(0, MAX_ANALYSIS_CHARS))
    : [];

  return {
    birthInfo: { year: y, month: m, day: d, hour: h, gender: g },
    analyses,
  };
}

export async function decodeShareCode(input: string): Promise<SharePayload | null> {
  if (!input || input.length > MAX_CODE_LENGTH * 2) return null;
  const code = extractCode(input);
  if (code.length > MAX_CODE_LENGTH) return null;

  // ── v2：gzip + crc32 ──
  if (code.startsWith(PREFIX_V2)) {
    const body = code.slice(PREFIX_V2.length);
    const dot = body.lastIndexOf('.');
    if (dot < 0) return null;
    const b64 = body.slice(0, dot);
    const sumHex = body.slice(dot + 1);
    if (!/^[0-9a-f]{8}$/i.test(sumHex)) return null;

    let compressed: Uint8Array;
    try {
      compressed = base64ToBytes(fromUrlSafe(b64));
    } catch {
      return null;
    }
    if (crc32(compressed).toString(16) !== sumHex.toLowerCase()) return null;

    const json = await gzipDecompress(compressed);
    if (!json) return null;
    try {
      return toPayload(JSON.parse(json));
    } catch {
      return null;
    }
  }

  // ── v1：未压缩（旧码兼容）──
  if (code.startsWith(PREFIX_V1)) {
    try {
      const json = new TextDecoder().decode(base64ToBytes(fromUrlSafe(code.slice(PREFIX_V1.length))));
      return toPayload(JSON.parse(json));
    } catch {
      return null;
    }
  }

  return null;
}

/** 生辰指纹：本地续聊 / 最近命盘的 localStorage key（不含姓名等隐私） */
export function birthKey(b: BirthInfo): string {
  return `${b.year}-${b.month}-${b.day}-${b.hour}-${b.gender === 'male' ? 'm' : 'f'}`;
}
