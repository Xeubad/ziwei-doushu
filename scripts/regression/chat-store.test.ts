/**
 * 本地续聊存储回归测试：lib/ai/chat-store
 * 运行：npx tsx scripts/regression/chat-store.test.ts
 *
 * Node 环境没有 localStorage，先垫一个内存实现。
 */

// ── 内存版 localStorage ──
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
};

// localStorage 只在函数内访问，静态导入安全
import { loadChat, saveChat, clearChat } from '../../lib/ai/chat-store';

let passed = 0;
let failed = 0;
function assert(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ ${name}`, detail ?? ''); }
}

const msgs = [
  { role: 'user' as const, content: '概述', hidden: true },
  { role: 'assistant' as const, content: '命格分析……' },
];

console.log('[chat-store] 版本化读写');
assert('无记录 → null', loadChat('k1') === null);
saveChat('k1', msgs);
const got = loadChat('k1');
assert('读回消息数正确', got?.length === 2, got);
assert('内容完整', got?.[1].content === '命格分析……');
const raw = JSON.parse(store.get('ziwei-chat-k1')!) as { v: number; savedAt: number };
assert('落盘带版本号 v=1', raw.v === 1);
assert('落盘带 savedAt', typeof raw.savedAt === 'number' && raw.savedAt > 0);

console.log('[chat-store] 结构防御');
store.set('ziwei-chat-bad1', '{"v":99,"messages":[]}');
assert('版本不符 → null', loadChat('bad1') === null);
store.set('ziwei-chat-bad2', '{"v":1}');
assert('缺 messages → null', loadChat('bad2') === null);
store.set('ziwei-chat-bad3', 'not-json{{{');
assert('损坏 JSON → null', loadChat('bad3') === null);
store.set('ziwei-chat-bad4', JSON.stringify({ v: 1, savedAt: Date.now(), messages: [{ role: 'hacker' }] }));
assert('非法消息被过滤 → null', loadChat('bad4') === null);

console.log('[chat-store] 旧格式兼容（裸数组）');
store.set('ziwei-chat-old', JSON.stringify(msgs));
const oldGot = loadChat('old');
assert('旧裸数组可读', oldGot?.length === 2);
saveChat('old', oldGot!);
assert('再写入后升级为 v1', (JSON.parse(store.get('ziwei-chat-old')!) as { v: number }).v === 1);

console.log('[chat-store] 过期清理与截断');
store.set('ziwei-chat-stale', JSON.stringify({
  v: 1, savedAt: Date.now() - 8 * 24 * 3600 * 1000, messages: msgs,
}));
assert('8 天前记录视为过期', loadChat('stale') === null);
assert('过期记录被清除', store.get('ziwei-chat-stale') === undefined);

const many = Array.from({ length: 80 }, (_, i) => ({ role: 'assistant' as const, content: `m${i}` }));
saveChat('k2', many);
assert('写入截断到 60 条', loadChat('k2')?.length === 60);
assert('保留的是最近的消息', loadChat('k2')?.[59].content === 'm79');

clearChat('k1');
assert('clearChat 生效', loadChat('k1') === null);

console.log(`\n[chat-store] ${passed} 通过，${failed} 失败`);
if (failed > 0) process.exit(1);
