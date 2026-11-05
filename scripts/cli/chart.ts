/**
 * 命令行排盘 —— 把网页版 /chart 的输入管线原样搬到终端
 *
 * 与 BirthForm → formToBirthInfo() → generateChart() 走同一条链路，
 * 保证 CLI 出的盘与网页版逐字一致（含经度校正的时辰判定与晚子时换日）。
 *
 * 用法：
 *   npx tsx scripts/cli/chart.ts --date 1995-08-12 --time 14:30 --gender male --city 福州
 *   npx tsx scripts/cli/chart.ts --date 1995-08-12 --unknown-time --gender female --city 厦门
 *   npx tsx scripts/cli/chart.ts ... --json                 # 输出整盘 JSON
 *   npx tsx scripts/cli/chart.ts ... --pair-date 1996-03-02 --pair-time 09:10 --pair-gender female --pair-city 泉州
 *
 * 退出码：0 成功 / 2 参数或地点解析失败
 */

import { generateChart } from '../../lib/ziwei/algorithm';
import { formToBirthInfo } from '../../lib/ziwei/share';
import { PROVINCES } from '../../lib/ziwei/cities';
import {
  chartToPromptText,
  patternsToPromptText,
  mingGongToPromptText,
  chartToCompactText,
} from '../../lib/ai/chart-summary';
import type { BirthFormState } from '../../components/BirthForm';
import type { BirthInfo, ZiweiChart } from '../../lib/ziwei/types';

const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

interface Args {
  [key: string]: string | boolean | undefined;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

/** 地点 → { province, city, longitude }；支持「福州」「福建省福州市」「厦门市」等写法 */
function resolveLocation(q: string): { province: string; city: string; longitude: number } | null {
  const norm = (s: string) => s.replace(/[省市区县]/g, '');
  const target = norm(q);

  // 先精确命中城市名（含「地级市·区县」形式里的一级）
  const exact: Array<{ province: string; city: string; longitude: number }> = [];
  for (const p of PROVINCES) {
    for (const c of p.cities) {
      const base = c.name.split('·')[0];
      if (norm(base) === target || norm(c.name) === target) {
        exact.push({ province: p.name, city: c.name, longitude: c.longitude });
      }
    }
    if (norm(p.name) === target && p.cities.length === 1) {
      exact.push({ province: p.name, city: p.cities[0].name, longitude: p.cities[0].longitude });
    }
  }
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    // 同名城市（如「城关」）取第一个，调用方负责提示
    return exact[0];
  }

  // 再退一步做包含匹配
  const loose: Array<{ province: string; city: string; longitude: number }> = [];
  for (const p of PROVINCES) {
    for (const c of p.cities) {
      if (norm(c.name).includes(target) || target.includes(norm(c.name).split('·')[0])) {
        loose.push({ province: p.name, city: c.name, longitude: c.longitude });
      }
    }
  }
  return loose.length > 0 ? loose[0] : null;
}

function splitDate(s: string): { y: string; m: string; d: string } | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
  if (!m) return null;
  return { y: m[1], m: m[2], d: m[3] };
}

function buildForm(a: Args, prefix = ''): BirthFormState {
  const dateStr = a[`${prefix}date`];
  if (typeof dateStr !== 'string') usage(`缺少 --${prefix}date（公历，格式 YYYY-MM-DD）`);
  const date = splitDate(dateStr);
  if (!date) usage(`--${prefix}date 格式应为 YYYY-MM-DD，收到 ${dateStr}`);

  const gender = a[`${prefix}gender`];
  if (gender !== 'male' && gender !== 'female') {
    usage(`--${prefix}gender 必须是 male 或 female，收到 ${String(gender)}`);
  }

  const unknownTime = Boolean(a[`${prefix}unknown-time`] ?? a[`${prefix}unknown`]);
  let clockHour = '0';
  let clockMinute = '0';
  if (!unknownTime) {
    const timeStr = a[`${prefix}time`];
    if (typeof timeStr !== 'string') {
      usage(`缺少 --${prefix}time（钟表时间 HH:MM）；确实不知道时辰请传 --${prefix}unknown-time`);
    }
    const tm = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
    if (!tm) usage(`--${prefix}time 格式应为 HH:MM，收到 ${timeStr}`);
    clockHour = String(parseInt(tm![1], 10));
    clockMinute = String(parseInt(tm![2], 10));
  }

  const cityArg = a[`${prefix}city`];
  let province = '';
  let city = '';
  let longitude = 120;
  if (typeof cityArg === 'string') {
    const loc = resolveLocation(cityArg);
    if (!loc) usage(`找不到出生地「${cityArg}」，请传地级市名（如 福州 / 泉州 / 厦门）`);
    province = loc!.province;
    city = loc!.city;
    longitude = loc!.longitude;
  }

  const nameArg = a[`${prefix}name`];

  return {
    name: typeof nameArg === 'string' ? nameArg : '',
    year: date!.y,
    month: date!.m,
    day: date!.d,
    clockHour,
    clockMinute,
    unknownTime,
    province,
    city,
    longitude,
    gender: gender as 'male' | 'female',
  };
}

function usage(msg: string): never {
  console.error(`错误：${msg}`);
  console.error(
    '\n用法: npx tsx scripts/cli/chart.ts --date YYYY-MM-DD --time HH:MM --gender male|female [--city 福州] [--name 张三] [--json]',
  );
  process.exit(2);
}

/** 一行「排盘依据」，把输入管线做了什么都摊开，方便核对 */
function basisLine(form: BirthFormState, info: BirthInfo, chart: ZiweiChart): string {
  const parts: string[] = [];
  parts.push(`输入 ${form.year}-${form.month}-${form.day} ${form.unknownTime ? '时辰未知' : `${form.clockHour}:${form.clockMinute.padStart(2, '0')}`}`);
  parts.push(`排盘日 ${info.year}-${info.month}-${info.day} ${SHICHEN[info.hour]}时`);
  if (info.year !== parseInt(form.year) || info.month !== parseInt(form.month) || info.day !== parseInt(form.day)) {
    parts.push('(晚子时已按次日排盘)');
  }
  if (form.province) {
    parts.push(`出生地 ${form.province}${form.city} 经度${form.longitude}° → 时辰校正 ${((form.longitude - 120) * 4).toFixed(0)} 分钟`);
  } else {
    parts.push('未提供出生地 → 不做经度校正');
  }
  parts.push(`${chart.wuxingJuName}`);
  return parts.join(' ｜ ');
}

function renderChart(form: BirthFormState, chart: ZiweiChart): string {
  return [
    basisLine(form, chart.birthInfo, chart),
    '',
    chartToPromptText(chart),
    patternsToPromptText(chart),
    mingGongToPromptText(chart),
  ].join('\n');
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  const form = buildForm(a);
  const info = formToBirthInfo(form);
  const chart = generateChart(info);

  if (a.json) {
    console.log(JSON.stringify(chart, null, 2));
    return;
  }

  console.log(renderChart(form, chart));

  // 合盘：第二人存在时追加精简摘要
  if (typeof a['pair-date'] === 'string') {
    const formB = buildForm(a, 'pair-');
    const chartB = generateChart(formToBirthInfo(formB));
    console.log('\n\n# 合盘（第二人）\n');
    console.log(chartToCompactText(chart, '命主A'));
    console.log('');
    console.log(chartToCompactText(chartB, '命主B'));
  }
}

main();
