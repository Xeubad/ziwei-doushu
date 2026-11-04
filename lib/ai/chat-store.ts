/**
 * lib/ai/chat-store —— 本地续聊的 localStorage 存取
 *
 * 记录结构带版本号与保存时间：
 *   { v: 1, savedAt: 1730000000000, messages: [...] }
 * - v 不匹配或结构损坏 → 视为无记录（回退到自动生成概述）
 * - 超过 7 天未动的记录读取时视为过期并清除
 * - 兼容旧版裸数组记录（无版本号）：能读则读，下次写入自动升级
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** 自动/话题消息不显示用户气泡 */
  hidden?: boolean;
  /** 错误提示（未配置 Key / 上游失败等），按警示卡渲染 */
  isError?: boolean;
}

const CHAT_STORAGE_PREFIX = 'ziwei-chat-';
const STORAGE_VERSION = 1;
const MAX_MESSAGES = 60;
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

interface ChatRecord {
  v: number;
  savedAt: number;
  messages: ChatMessage[];
}

function isChatMessage(v: unknown): v is ChatMessage {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  return (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
}

export function loadChat(key: string): ChatMessage[] | null {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;

    // 旧版裸数组：直接当 messages 用
    if (Array.isArray(parsed)) {
      const messages = parsed.filter(isChatMessage);
      return messages.length > 0 ? messages : null;
    }

    const rec = parsed as Partial<ChatRecord>;
    if (rec.v !== STORAGE_VERSION || !Array.isArray(rec.messages)) return null;
    if (typeof rec.savedAt === 'number' && Date.now() - rec.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(CHAT_STORAGE_PREFIX + key);
      return null; // 过期清除
    }
    const messages = rec.messages.filter(isChatMessage);
    return messages.length > 0 ? messages.slice(-MAX_MESSAGES) : null;
  } catch {
    return null;
  }
}

export function saveChat(key: string, messages: ChatMessage[]): void {
  try {
    const record: ChatRecord = {
      v: STORAGE_VERSION,
      savedAt: Date.now(),
      messages: messages.slice(-MAX_MESSAGES),
    };
    localStorage.setItem(CHAT_STORAGE_PREFIX + key, JSON.stringify(record));
  } catch { /* 隐私模式/配额满时静默失败 */ }
}

/** 清除指定生辰指纹的续聊记录（重新起盘/手动清空用） */
export function clearChat(key: string): void {
  try {
    localStorage.removeItem(CHAT_STORAGE_PREFIX + key);
  } catch { /* ignore */ }
}
