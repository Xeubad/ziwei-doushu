/**
 * lib/ai/chart-summary —— 把 ZiweiChart 压成喂给 LLM 的结构化文本
 *
 * 命盘整包 JSON 直接进 prompt 会浪费大量 token（含算法内部字段），
 * 这里只提取论命需要的信息：生辰、五行局、十二宫星曜四化、大限、格局。
 * 仅供服务端（API 路由）使用 —— 依赖 server-only 的 patterns.ts。
 */

import type { ZiweiChart, Palace, Star } from '@/lib/ziwei/types';
import { detectPatterns, getMingGongSummary } from '@/lib/ziwei/patterns';

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const GENDER_CN = { male: '男', female: '女' } as const;

/** 一颗星：名称 + 亮度 + 四化，如「紫微(旺,化权)」 */
function starText(star: Star): string {
  const marks: string[] = [];
  if (star.brightnessRaw) marks.push(star.brightnessRaw);
  if (star.siHua) marks.push(`化${star.siHua}`);
  return marks.length > 0 ? `${star.name}(${marks.join(',')})` : star.name;
}

/** 一宫：干支 + 星曜 + 自化 + 大限；容忍缺字段的畸形数据 */
function palaceText(palace: Palace): string {
  const stars = palace.stars ?? [];
  const major = stars.filter(s => s.type === 'major').map(starText);
  const minor = stars.filter(s => s.type === 'minor').map(starText);
  const lucky = stars.filter(s => s.type === 'lucky').map(starText);
  const sha = stars.filter(s => s.type === 'sha').map(starText);

  const parts: string[] = [];
  parts.push(`【${palace.name}】${STEMS[palace.stem]}${BRANCHES[palace.branch]}`);
  parts.push(`主星:${major.length > 0 ? major.join('、') : '空宫'}`);
  if (minor.length > 0) parts.push(`辅星:${minor.join('、')}`);
  if (lucky.length > 0) parts.push(`吉星:${lucky.join('、')}`);
  if (sha.length > 0) parts.push(`煞星:${sha.join('、')}`);
  if (palace.isEmpty && palace.borrowedStars && palace.borrowedStars.length > 0) {
    parts.push(`借对宫[${palace.borrowedFromName}]主星:${palace.borrowedStars.join('、')}`);
  }
  if (palace.selfSihua && palace.selfSihua.length > 0) {
    parts.push(`自化:${palace.selfSihua.map(s => `${s.starName}自化${s.siHua}`).join('、')}`);
  }
  if (palace.daXianAge) parts.push(`大限:${palace.daXianAge[0]}-${palace.daXianAge[1]}岁`);
  if (palace.isMingGong) parts.push('(命宫)');
  if (palace.isShenGong) parts.push('(身宫)');
  return parts.join(' ');
}

/** 命盘 → 论命文本（system prompt 的一部分）；容忍缺字段的畸形数据 */
export function chartToPromptText(chart: ZiweiChart): string {
  const birthInfo = chart.birthInfo ?? ({} as ZiweiChart['birthInfo']);
  const lunarInfo = chart.lunarInfo ?? ({} as ZiweiChart['lunarInfo']);
  const daXians = chart.daXians ?? [];
  const lines: string[] = [];

  // ── 基础信息 ──
  lines.push('## 命主信息');
  lines.push(
    `性别:${GENDER_CN[birthInfo.gender] ?? '未知'} 公历:${birthInfo.year}年${birthInfo.month}月${birthInfo.day}日`
  );
  if (birthInfo.origInput) {
    const o = birthInfo.origInput;
    lines.push(`原始输入时间:${o.year}-${o.month}-${o.day} ${o.clockHour}:${String(o.clockMinute).padStart(2, '0')}`);
  }
  lines.push(
    `农历:${lunarInfo.lunarYear}年${lunarInfo.isLeapMonth ? '闰' : ''}${lunarInfo.lunarMonth}月${lunarInfo.lunarDay}日 时辰:${BRANCHES[birthInfo.hour] ?? '?'}时`
  );
  if (lunarInfo.fourPillars) {
    lines.push(`四柱(节气):${lunarInfo.fourPillars.join(' ')}`);
  }
  if (lunarInfo.fourPillarsLunar) {
    lines.push(`四柱(农历):${lunarInfo.fourPillarsLunar.join(' ')}`);
  }
  lines.push(
    `五行局:${chart.wuxingJuName} 命宫:${BRANCHES[chart.mingGongBranch] ?? '?'} 身宫:${BRANCHES[chart.shenGongBranch] ?? '?'}`
  );
  if (chart.mingZhu) lines.push(`命主星:${chart.mingZhu} 身主星:${chart.shenZhu ?? '—'}`);
  if (chart.yinYangGender) lines.push(`阴阳性别:${chart.yinYangGender}`);
  lines.push(`当前年龄:${chart.currentAge}岁(虚岁) 当前大限:${daXians[chart.currentDaXianIndex]?.palaceName ?? '—'}`);

  // ── 十二宫 ──
  lines.push('');
  lines.push('## 十二宫');
  for (const palace of chart.palaces ?? []) {
    lines.push(palaceText(palace));
  }

  // ── 大限 ──
  lines.push('');
  lines.push('## 大限(每十年行运)');
  for (let i = 0; i < daXians.length; i++) {
    const d = daXians[i];
    const mark = i === chart.currentDaXianIndex ? ' ← 当前' : '';
    const sihua = d.siHua
      ? ` 四化:禄${d.siHua.lu}/权${d.siHua.quan}/科${d.siHua.ke}/忌${d.siHua.ji}`
      : '';
    lines.push(`${d.startAge}-${d.endAge}岁 ${d.palaceName}(${STEMS[d.stemIndex ?? 0] ?? '?'}${BRANCHES[d.palaceBranch] ?? '?'})${sihua}${mark}`);
  }

  return lines.join('\n');
}

/** 格局识别结果 → 文本；没有格局时返回空串 */
export function patternsToPromptText(chart: ZiweiChart): string {
  const patterns = detectPatterns(chart);
  if (patterns.length === 0) return '';
  const lines = ['', '## 格局识别(排盘引擎判定)', ''];
  for (const p of patterns) {
    const level = { excellent: '上格', good: '吉格', neutral: '平格', caution: '凶格' }[p.level];
    lines.push(`- 【${p.name}】(${level})${p.palaces.length > 0 ? ` 相关宫位:${p.palaces.join('/')}` : ''} ${p.description}`);
    if (p.source) lines.push(`  出处:${p.source}`);
  }
  return lines.join('\n');
}

/** 命宫主星定调 → 文本 */
export function mingGongToPromptText(chart: ZiweiChart): string {
  const s = getMingGongSummary(chart);
  return ['', '## 命宫定调', `主星:${s.stars.join('、') || '空宫(借对宫)'} 关键词:${s.keywords.join('、')} 星性:${s.nature}`].join('\n');
}

/** 合盘用：精简命盘摘要（一人一份，控制 token）；容忍缺字段的畸形数据 */
export function chartToCompactText(chart: ZiweiChart, label: string): string {
  const birthInfo = chart.birthInfo ?? ({} as ZiweiChart['birthInfo']);
  const palaces = chart.palaces ?? [];
  const daXians = chart.daXians ?? [];
  const fuqi = palaces.find(p => p.name === '夫妻');
  const ming = palaces.find(p => p.name === '命宫');
  const fude = palaces.find(p => p.name === '福德');
  const lines: string[] = [];
  lines.push(`### ${label}`);
  lines.push(
    `性别:${GENDER_CN[birthInfo.gender] ?? '未知'} 公历:${birthInfo.year}-${birthInfo.month}-${birthInfo.day} 时辰:${BRANCHES[birthInfo.hour] ?? '?'}时 五行局:${chart.wuxingJuName} 当前:${chart.currentAge}岁`
  );
  if (ming) lines.push(`命宫:${palaceText(ming)}`);
  if (fuqi) lines.push(`夫妻宫:${palaceText(fuqi)}`);
  if (fude) lines.push(`福德宫:${palaceText(fude)}`);
  // 其余宫位只列主星，省 token
  for (const p of palaces) {
    if (p.name === '命宫' || p.name === '夫妻' || p.name === '福德') continue;
    const major = p.stars.filter(s => s.type === 'major').map(starText);
    lines.push(`${p.name}:${major.length > 0 ? major.join('、') : '空宫'}`);
  }
  const cur = daXians[chart.currentDaXianIndex];
  if (cur) {
    lines.push(`当前大限:${cur.startAge}-${cur.endAge}岁行${cur.palaceName}`);
  }
  return lines.join('\n');
}
