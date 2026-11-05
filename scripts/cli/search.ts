/**
 * 命令行语料检索 —— 给对话式论命找原文依据
 *
 * 三个语料源：
 *   classics  古籍原典（紫微斗数全书 / 全集 / 骨髓赋 等，lib/classics/data）
 *   entries   倪海厦天纪讲稿逐句条目（docs/tianji-ziwei/entries.jsonl，1848 条）
 *   nihai     倪海厦天纪/人纪/地纪模块内容（lib/nihai，结构化讲解）
 *
 * 用法：
 *   npx tsx scripts/cli/search.ts 太阴 化忌                 # 全部源，AND 语义
 *   npx tsx scripts/cli/search.ts 府相朝垣 --src classics    # 只查古籍
 *   npx tsx scripts/cli/search.ts 身宫 --src nihai --limit 10
 *
 * 检索方式是最朴素的子串匹配（中文不用分词），没有语义检索。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { ALL_BOOKS } from '../../lib/classics';
import { TIANJI_MODULES, TIANJI_QUOTES, TIANJI_EPISODES } from '../../lib/nihai/tianji';
import { RENJI_MODULES } from '../../lib/nihai/renji';
import { DIJI_MODULES } from '../../lib/nihai/diji';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');

const argv = process.argv.slice(2);
const flags: Record<string, string> = {};
const terms: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { flags[key] = next; i++; } else flags[key] = 'true';
  } else terms.push(a);
}

if (terms.length === 0) {
  console.error('用法: npx tsx scripts/cli/search.ts 关键词 [关键词2 ...] [--src all|classics|entries|nihai] [--limit N]');
  process.exit(2);
}

const src = (flags.src ?? 'all') as 'all' | 'classics' | 'entries' | 'nihai';
const limit = parseInt(flags.limit ?? '6', 10);
const match = (text: string) => terms.every(t => text.includes(t));

let total = 0;
const out: string[] = [];

// ── 古籍原典 ──
if (src === 'all' || src === 'classics') {
  let n = 0;
  for (const book of ALL_BOOKS) {
    for (const ch of book.chapters) {
      for (const p of ch.paragraphs) {
        if (!match(p.text)) continue;
        out.push(`[古籍] 《${book.title}·${ch.title}》#${p.id}\n  ${p.text}`);
        total++; n++;
        if (n >= limit) break;
      }
      if (n >= limit) break;
    }
    if (n >= limit) break;
  }
}

// ── 天纪讲稿条目 ──
if (src === 'all' || src === 'entries') {
  const raw = readFileSync(resolve(REPO, 'docs/tianji-ziwei/entries.jsonl'), 'utf8');
  let n = 0;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let e: any;
    try { e = JSON.parse(line); } catch { continue; }
    const hay = [e.quote, e.note, e.h2, e.h3].filter(Boolean).join(' ');
    if (!match(hay)) continue;
    out.push(`[天纪讲稿] ${e.book} / ${e.h2 ?? ''} / ${e.h3 ?? ''} @ ${e.t_hms}\n  ${e.quote}`);
    total++; n++;
    if (n >= limit) break;
  }
}

// ── 倪海厦模块内容 ──
if (src === 'all' || src === 'nihai') {
  const roots: Array<[string, unknown]> = [
    ['天纪', TIANJI_MODULES],
    ['人纪', RENJI_MODULES],
    ['地纪', DIJI_MODULES],
    ['天纪·语录', TIANJI_QUOTES],
    ['天纪·课表', TIANJI_EPISODES],
  ];
  let n = 0;
  const seen = new Set<string>();
  for (const [label, root] of roots) {
    if (n >= limit) break;
    const stack: Array<{ path: string; val: unknown }> = [{ path: label, val: root }];
    while (stack.length > 0 && n < limit) {
      const { path, val } = stack.pop()!;
      if (typeof val === 'string') {
        if (val.length >= 6 && match(val) && !seen.has(val)) {
          seen.add(val);
          out.push(`[倪海厦·${label}] ${path}\n  ${val.slice(0, 400)}`);
          total++; n++;
        }
        continue;
      }
      if (Array.isArray(val)) {
        val.forEach((v, i) => stack.push({ path: `${path}[${i}]`, val: v }));
        continue;
      }
      if (val && typeof val === 'object') {
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          if (k === 'name' || k === 'title') {
            // 标题单独标记，便于定位
            stack.push({ path: `${path}.${k}`, val: v });
          } else {
            stack.push({ path: `${path}.${k}`, val: v });
          }
        }
      }
    }
  }
}

if (total === 0) {
  console.log(`没有命中：${terms.join(' + ')}（源：${src}）`);
  process.exit(0);
}
console.log(out.join('\n\n'));
console.log(`\n—— 共 ${total} 条（源：${src}，AND 语义：${terms.join(' + ')}）`);
