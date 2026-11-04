/**
 * components/insight/prompts —— 解读面板的话题 / 宫位 / 四化提示词模板
 * 从 InsightPanel 拆出，纯数据 + 纯函数，便于测试与维护。
 */

import type { Palace } from '@/lib/ziwei/types';
import type { TimeView } from '../TimeNav';

export const TOPICS = [
  { key: 'overview',     label: '命格' },
  { key: 'love',        label: '感情' },
  { key: 'career',      label: '事业' },
  { key: 'wealth',      label: '财运' },
  { key: 'health',      label: '健康' },
  { key: 'personality', label: '性格' },
] as const;

export type TopicKey = (typeof TOPICS)[number]['key'];

export const TOPIC_PROMPTS: Record<TopicKey, string> = {
  overview: `请生成命格总览，按以下结构输出：

**【命格定性】**
用一句话概括这个命盘的核心格局与命主气质。

**【主星解读】**
命宫主星的核心特质，引用倪海厦原话或观点。

**【三方四正】**
财、官、迁三宫的联动分析及整体格局。

**【当前大限】**
当下大限运势方向与最值得关注的事项。

**【优势与注意】**
命盘天赋优势，以及需要注意的风险或功课。`,

  love: `请深度分析感情婚姻运，按以下结构输出：

**【感情格局】**
一句话定性感情命格。

**【夫妻宫分析】**
夫妻宫主星、四化，以及倪海厦体系的具体解读。

**【三方联动】**
相关宫位对感情的影响。

**【当前大限感情运】**
当下10年感情走向与关键节点。

**【实际建议】**
具体可行的感情建议。`,

  career: `请深度分析事业运，按以下结构输出：

**【事业格局】**
一句话定性事业命格，宜任职或宜创业。

**【官禄宫分析】**
官禄宫主星、四化，以及倪师对这种配置的判断。

**【财帛宫联动】**
财运与事业的关系，财路来源分析。

**【当前大限事业运】**
当下10年事业走向。

**【实际建议】**
适合的方向、行业与策略。`,

  wealth: `请深度分析财运，按以下结构输出：

**【财运格局】**
一句话定性财运模式，是主动财还是被动财。

**【财帛宫分析】**
财帛宫主星、四化，财富来源与流动模式。

**【田宅宫（财库）】**
积蓄能力与不动产运势分析。

**【当前大限财运】**
当下财运走向与注意事项。

**【理财建议】**
具体的财务建议。`,

  health: `请分析健康运势，按以下结构输出：

**【疾厄宫主星】**
疾厄宫星曜与健康含义。

**【主要风险】**
结合倪海厦子午流注理论，分析主要健康隐患与需关注的部位。

**【大限健康走势】**
当下健康趋势与关键时间段。

**【预防建议】**
具体注意事项与养生方向。`,

  personality: `请深度解析性格特质，按以下结构输出：

**【命宫主星性格】**
命宫主星的核心性格特质，引用倪师原话。

**【三方性格综合】**
财、官、迁三宫对性格的影响，全貌描绘。

**【人际关系模式】**
与他人互动方式、待人处世风格。

**【优势与人生课题】**
天赋优势，以及需要面对的人生功课。`,
};

export const PALACE_ROLES: Record<string, string> = {
  // iztro 宫名口径：仅命宫带「宫」字，「交友」在 iztro 里叫「仆役」
  '命宫':   '自我、性格、先天格局',
  '兄弟':   '兄弟关系、合伙人',
  '夫妻':   '感情关系、婚姻状态',
  '子女':   '子女缘分、下属关系',
  '财帛':   '财运来源、收入方式',
  '疾厄':   '身体健康、意外',
  '迁移':   '外出机遇、人际格局',
  '仆役':   '朋友圈、贵人、小人',
  '官禄':   '事业成就、社会地位',
  '田宅':   '不动产、家庭环境',
  '福德':   '精神享受、内心福分',
  '父母':   '父母关系、文书契约',
};

export function buildPalacePrompt(palace: Palace): string {
  const majorStars = palace.stars.filter(s => s.type === 'major');
  const starDesc = majorStars.length > 0
    ? majorStars.map(s => `${s.name}${s.siHua ? '化' + s.siHua : ''}`).join('、')
    : '空宫（借对宫）';
  const role = PALACE_ROLES[palace.name] ?? '';

  return `请重点分析【${palace.name}】（主管：${role}），该宫主星为${starDesc}，按以下结构输出：

**【宫位定性】**
${palace.name}在命盘中的意义，以及这种星曜配置的整体判断。

**【主星解读】**
主星在此宫的倪海厦体系解读，引用具体观点。

**【三方四正联动】**
三方四正宫位对此宫的影响。

**【实际建议】**
基于此宫的具体建议。`;
}

export function buildSiHuaPrompt(
  starName: string,
  siHua: string,
  view: TimeView,
  palaceName: string,
): string {
  const viewLabel = view === 'daxian' ? '大限' : view === 'mingpan' ? '本命' : '流年';
  return `请分析【${viewLabel}${starName}化${siHua}】的飞化影响，按以下结构输出：

**【化${siHua}基本含义】**
化${siHua}在倪海厦体系中的核心含义，以及${starName}化${siHua}的特殊含义。

**【落宫影响】**
${starName}化${siHua}落在【${palaceName}】，该宫主管的领域受到何种影响，倪师如何解读。

**【三方四正飞化路径】**
化${siHua}入${palaceName}后，对其三方四正（对宫、两个三合宫）的联动影响。

**【当前运势影响】**
在${viewLabel}时间维度下，此化${siHua}对命主近期运势的具体影响。

**【实际建议】**
基于此四化的具体可操作建议。`;
}
