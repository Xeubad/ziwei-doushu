/**
 * lib/ziwei/share-codec —— 命盘分享码的编解码
 *
 * 分享码 = 生辰（用于确定性重建盘面）+ AI 分析快照（发起人已生成的解读）。
 * **不含提问记录**（隐私），也不含对话能力（接收方只读）。
 *
 * 格式：`1.<base64url(JSON)>`
 *   { v: 1, b: { y, m, d, h, g }, a: ["分析文本", ...] }
 *   - b：最终 BirthInfo 的紧凑形式（h 已含真太阳时校正，g = m/f）
 *   - a：assistant 分析内容，最多 6 条、单条 4000 字
 *
 * 编解码在浏览器与 Node（测试）中通用：UTF-8 → base64url。
 */

import type { BirthInfo } from './types';

const PREFIX = '1.';
const MAX_ANALYSES = 6;
const MAX_ANALYSIS_CHARS = 4000;
const MAX_CODE_LENGTH = 24_000;

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

// ── base64url（UTF-8 安全）─────────────────────────────────

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function toUrlSafe(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromUrlSafe(s: string): string {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  return b64;
}

// ── 编码 ──────────────────────────────────────────────────

export function encodeShareCode({ birthInfo, analyses }: SharePayload): string {
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

  const payload = { v: 1, b: birth, a: safeAnalyses };
  return PREFIX + toUrlSafe(utf8ToBase64(JSON.stringify(payload)));
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

export function decodeShareCode(input: string): SharePayload | null {
  if (!input || input.length > MAX_CODE_LENGTH * 2) return null;
  const code = extractCode(input);
  if (!code.startsWith(PREFIX) || code.length > MAX_CODE_LENGTH) return null;

  let data: unknown;
  try {
    data = JSON.parse(base64ToUtf8(fromUrlSafe(code.slice(PREFIX.length))));
  } catch {
    return null;
  }
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

/** 生辰指纹：本地续聊 / 最近命盘的 localStorage key（不含姓名等隐私） */
export function birthKey(b: BirthInfo): string {
  return `${b.year}-${b.month}-${b.day}-${b.hour}-${b.gender === 'male' ? 'm' : 'f'}`;
}
