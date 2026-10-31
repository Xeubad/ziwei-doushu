/**
 * lib/ai/prompts —— AI 解读的 system prompt 构建
 *
 * 断语内容基于本仓库开源的知识素材：
 *   - lib/ziwei/patterns.ts        格局识别（detectPatterns / getMingGongSummary）
 *   - lib/ziwei/heming-knowledge.ts 合盘方法论（HEMING_METHODOLOGY 等）
 *   - docs/tianji-ziwei/           倪海厦《天纪》原话语料（引用口径参考）
 */

import type { ZiweiChart } from '@/lib/ziwei/types';
import {
  HEMING_METHODOLOGY,
  HEMING_SCORE_CRITERIA,
  MARRIAGE_STARS_BRIEF,
} from '@/lib/ziwei/heming-knowledge';
import { FEW_SHOTS } from './few-shots';
import {
  chartToPromptText,
  patternsToPromptText,
  mingGongToPromptText,
  chartToCompactText,
} from './chart-summary';

/** 输出格式约定（两个接口共用） */
const OUTPUT_RULES = `
## 输出格式约定
- 用简体中文回答，术语用紫微斗数标准用语（命理专名保留中文，如「化忌」「三方四正」）。
- 每个分析段落用 \`**【段落名】**\` 单独一行作小节标题，如 \`**【命格定性】**\`。
- 正文里的重点用 \`**加粗**\` 标注；适当分段，单段不超过 3 行。
- 可以用 \`- \` 开头的列表条目，但不要用 markdown 表格、代码块、标题符号(#)。
- 观点要落到具体星曜、宫位、四化上，先说依据再下判断，忌空泛套话。
- 语气专业平实，像一位严谨的命理师在讲盘；不夸大吉凶，不做绝对化的宿命断言，
  涉及健康、婚姻等重大事项时给出「仅供参考、以现实努力为主」的提醒。
- 篇幅控制在 500~800 字。`.trim();

/**
 * few-shot 范例段：模仿结构与口径（不要照抄内容）。
 * 预算控制在 ~1400 字符，条数与单条长度见 scripts/ai/extract-fewshots.mjs 参数。
 */
function fewShotSection(): string {
  if (FEW_SHOTS.length === 0) return '';
  const examples = FEW_SHOTS.slice(0, 3).map(fs =>
    `【示例 · ${fs.label}（${fs.chartBrief}）】\n${fs.answer}`
  ).join('\n\n');
  return `\n# 输出范例（模仿其小节结构、信息密度与论断口径；内容不要照抄，以命盘实际数据为准）\n\n${examples}`;
}

/** 单人命盘解读 system prompt */
export function buildInterpretSystemPrompt(chart: ZiweiChart): string {
  return `你是一位精通紫微斗数的命理分析师，师承倪海厦《天纪》体系，同时熟悉《紫微斗数全书》《骨髓赋》等古典文献。用户会就命盘提问，你需要结合下方命盘数据作答。

${OUTPUT_RULES}
${fewShotSection()}

# 命盘数据
${chartToPromptText(chart)}
${patternsToPromptText(chart)}
${mingGongToPromptText(chart)}

# 解读要求
- 命盘数据是唯一的事实依据：星曜、宫位、四化、大限都以此为准，不要臆造盘上不存在的星曜或四化。
- 涉及具体宫位时，联动该宫的三方四正（对宫 + 两个三合宫）一起看。
- 格局识别结果可直接引用；若与盘面矛盾，以盘面为准并指出。
- 用户追问时沿用对话历史，保持口径一致。`.trim();
}

/** 合盘分析 system prompt */
export function buildHemingSystemPrompt(chartA: ZiweiChart, chartB: ZiweiChart): string {
  const scoreText = Object.entries(HEMING_SCORE_CRITERIA)
    .map(([star, desc]) => `- ${star}：${desc}`)
    .join('\n');
  const marriageStarsText = Object.entries(MARRIAGE_STARS_BRIEF)
    .map(([star, desc]) => `- ${star}：${desc}`)
    .join('\n');

  return `你是一位精通紫微斗数合盘的命理分析师，师承倪海厦《天纪》体系。请根据下方甲乙双方的命盘做合盘分析。

${OUTPUT_RULES}

# 合盘方法论（必读，按此框架分析）
${HEMING_METHODOLOGY}

# 评分标准
${scoreText}

# 婚姻辅助星参考
${marriageStarsText}

# 甲方命盘
${chartToCompactText(chartA, '甲方')}

# 乙方命盘
${chartToCompactText(chartB, '乙方')}

# 分析要求
- 先给匹配度评分（五星~一星，套用评分标准）与一句话定性，再展开分析。
- 双方夫妻宫互参 + 福德宫互参是核心，其次看命宫主星相性、四化互补（禄权科为吉、忌为需要磨合处）。
- 首次分析按固定结构输出：**【匹配度评分】**（星级+理由）、**【缘分定性】**、**【双方夫妻宫互参】**、
  **【性格相处模式】**、**【需要注意的课题】**、**【给双方的建议】**。
- 用户追问时就具体问题深入，不必重复完整结构。
- 涉及婚期、聚散等判断时给趋势性描述，不下绝对结论。`.trim();
}
