#!/usr/bin/env node
/**
 * scripts/ai/extract-fewshots.mjs —— 从解读数据集精选 few-shot 范例
 *
 * 数据集格式（v4.0 13 维解读数据集，JSON Lines，每行一张盘）：
 *   k: "YYYY-MM-DD-时辰序号-性别"   y/m/d: 公历生日   h: 时辰序号 0-11（子=0）
 *   g: male|female   ms: 命宫第一颗主星（无主星为 null）
 *   t: 各维字数   c: { overview, personality, love, career, ... } 13 维 Markdown
 *
 * 用法：
 *   node scripts/ai/extract-fewshots.mjs <year-1990.jsonl | 数据集目录> [选项]
 *
 * 选项：
 *   --count N        范例总数上限（默认 8，按命宫主星分组去重后取）
 *   --dim KEY        取哪个维度做范例（默认 overview）
 *   --max-chars N    单条范例正文字数上限（默认 420，按段落/句号边界截断）
 *   --seed N         随机种子（默认 42；同种子同输入产出完全一致）
 *   --out PATH       输出文件（默认 lib/ai/few-shots.generated.ts）
 *
 * 产出的 TS 文件会被 lib/ai/few-shots.ts 引用并注入 AI 解读 system prompt。
 * 数据集许可 CC BY 4.0（见 DATASET-LICENSE），生成文件自带来源标注。
 */

import { createReadStream, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';

// ── 参数解析 ──────────────────────────────────────────────
const args = process.argv.slice(2);
// 收集位置参数：跳过 --opt 及其后随的值
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) { i++; continue; } // 跳过选项和它的值
  files.push(args[i]);
}
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : dflt;
};

const COUNT = Number(opt('count', 8));
const DIM = opt('dim', 'overview');
const MAX_CHARS = Number(opt('max-chars', 420));
const SEED = Number(opt('seed', 42));
const OUT = resolve(opt('out', 'lib/ai/few-shots.generated.ts'));

if (files.length === 0) {
  console.error('用法: node scripts/ai/extract-fewshots.mjs <jsonl文件或目录> [--count N] [--dim overview] [--max-chars 420] [--seed 42]');
  process.exit(1);
}

// 目录展开为全部 *.jsonl
const jsonlFiles = [];
for (const f of files) {
  const st = statSync(f);
  if (st.isDirectory()) {
    for (const name of readdirSync(f)) {
      if (name.endsWith('.jsonl')) jsonlFiles.push(join(f, name));
    }
  } else {
    jsonlFiles.push(f);
  }
}
jsonlFiles.sort(); // 确定性
if (jsonlFiles.length === 0) {
  console.error('未找到任何 .jsonl 文件');
  process.exit(1);
}

// ── 确定性伪随机（LCG，避免 Math.random 不可复现）──
let rngState = SEED >>> 0 || 1;
const rand = () => {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 0xffffffff;
};

// ── 截断到段落/句号边界 ──────────────────────────────────
function trimToBoundary(text, max) {
  const clean = text.replace(/\r/g, '').trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  // 优先在段落边界截断，其次句号/换行，最后硬截
  const cuts = [slice.lastIndexOf('\n\n'), slice.lastIndexOf('。'), slice.lastIndexOf('\n')];
  const cut = Math.max(...cuts);
  return (cut > max * 0.5 ? slice.slice(0, cut + 1) : slice).trim();
}

const HOUR_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// ── 流式读取，按命宫主星分组收集候选 ──────────────────────
/** ms 分组 → 该组收集到的候选（每组留少量，最后随机取一条） */
const groups = new Map();
const POOL_PER_GROUP = 5;

for (const file of jsonlFiles) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row;
    try { row = JSON.parse(trimmed); } catch { continue; }

    const answer = row?.c?.[DIM];
    if (typeof answer !== 'string' || answer.length < 80) continue;

    const key = row.ms ?? '__kong__';
    if (!groups.has(key)) groups.set(key, []);
    const pool = groups.get(key);
    if (pool.length < POOL_PER_GROUP) {
      pool.push({ row, answer, source: file });
    } else {
      // 蓄水池抽样：保持确定性的同时均匀覆盖长文件
      const j = Math.floor(rand() * (pool.length + 1));
      if (j < POOL_PER_GROUP) pool[j] = { row, answer, source: file };
    }
  }
}

// ── 每组取一条，凑够 COUNT ────────────────────────────────
const groupKeys = [...groups.keys()].sort(); // 确定性顺序
const picked = [];
for (const key of groupKeys) {
  if (picked.length >= COUNT) break;
  const pool = groups.get(key);
  picked.push(pool[Math.floor(rand() * pool.length)]);
}

if (picked.length === 0) {
  console.error('数据集中没有找到有效样本（检查维度名 --dim 是否存在）');
  process.exit(1);
}

// ── 生成 TS ──────────────────────────────────────────────
const entries = picked.map(({ row, answer }) => {
  const gender = row.g === 'female' ? '女' : '男';
  const hour = HOUR_NAMES[row.h] ?? String(row.h);
  const label = row.ms ? `命宫${row.ms}` : '命宫空宫（借对宫）';
  const chartBrief = `公历 ${row.y}-${String(row.m).padStart(2, '0')}-${String(row.d).padStart(2, '0')} ${hour}时 ${gender} · ${label}`;
  return { label, chartBrief, answer: trimToBoundary(answer, MAX_CHARS) };
});

const body = entries
  .map(e => `  {\n    label: ${JSON.stringify(e.label)},\n    chartBrief: ${JSON.stringify(e.chartBrief)},\n    answer: ${JSON.stringify(e.answer)},\n  },`)
  .join('\n');

const out = `/**
 * lib/ai/few-shots.generated.ts —— 由 scripts/ai/extract-fewshots.mjs 生成，请勿手改
 *
 * 范例取自「紫微斗数开源解读数据集」（CC BY 4.0）
 * 来源：https://github.com/Renhuai123/ziwei-doushu  作者：王多鱼AI
 * 生成参数：dim=${DIM} count=${COUNT} max-chars=${MAX_CHARS} seed=${SEED}
 */

import type { FewShotExample } from './few-shots';

export const GENERATED_FEW_SHOTS: FewShotExample[] = [
${body}
];
`;

writeFileSync(OUT, out);
console.log(`✅ 已生成 ${OUT}：${entries.length} 条范例（维度 ${DIM}，来源文件 ${jsonlFiles.length} 个）`);
for (const e of entries) {
  console.log(`   - ${e.label} | ${e.chartBrief} | ${e.answer.length} 字`);
}
