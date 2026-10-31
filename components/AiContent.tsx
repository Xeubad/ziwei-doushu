'use client';

/**
 * components/AiContent —— AI 输出的极简 markdown 渲染器
 *
 * ChatPanel / InsightPanel / heming 页共用。约定（lib/ai/prompts.ts 的输出规则）：
 *   `**【段落名】**` 单独一行 → 金色小节标题
 *   `**加粗**`               → strong
 *   `- 条目` / `1. 条目`     → 列表
 *   `> 引用` / `---` / `` `code` `` → 引用 / 分割线 / 行内代码
 *   `#` / `##` 标题          → 同小节标题（容错，模型偶尔会用）
 */

import { Fragment } from 'react';

type Inline = { kind: 'text'; value: string } | { kind: 'bold'; value: string } | { kind: 'code'; value: string };

/** 把一行拆成 text/bold/code 片段 */
function parseInline(line: string): Inline[] {
  const parts: Inline[] = [];
  // 先按 `code` 切，再在文本段里切 **bold**（code 内的 ** 不再解析）
  for (const codeSeg of line.split(/(`[^`]+`)/)) {
    if (codeSeg.length === 0) continue;
    if (codeSeg.startsWith('`') && codeSeg.endsWith('`') && codeSeg.length > 2) {
      parts.push({ kind: 'code', value: codeSeg.slice(1, -1) });
      continue;
    }
    for (const seg of codeSeg.split(/(\*\*[^*]+\*\*)/)) {
      if (seg.length === 0) continue;
      if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
        parts.push({ kind: 'bold', value: seg.slice(2, -2) });
      } else {
        parts.push({ kind: 'text', value: seg });
      }
    }
  }
  return parts;
}

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === 'bold' ? (
          <strong key={i}>{p.value}</strong>
        ) : p.kind === 'code' ? (
          <code key={i}>{p.value}</code>
        ) : (
          <Fragment key={i}>{p.value}</Fragment>
        )
      )}
    </>
  );
}

/** 小节标题行：`**【x】**` / `**x**` 单独一行 / `## x` */
function sectionTitle(line: string): string | null {
  const m = line.match(/^(?:#{1,4}\s*|\*\*)【?(.+?)】?(?:\*\*)?$/);
  if (!m) return null;
  // `**【x】**` 形式优先还原出【x】样式
  const bracket = line.match(/^\*\*【(.+?)】\*\*$/);
  return bracket ? `【${bracket[1]}】` : m[1];
}

export default function AiContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let listBuf: { ordered: boolean; items: string[] } | null = null;

  const flushList = (key: number) => {
    if (!listBuf) return;
    const { ordered, items } = listBuf;
    blocks.push(
      <div key={`list-${key}`} className={ordered ? 'ai-num-list' : ''} style={{ margin: '2px 0' }}>
        {items.map((item, i) =>
          ordered ? (
            <div key={i} className="ai-num">
              <span className="ai-num-idx">{i + 1}.</span>
              <span><InlineText parts={parseInline(item)} /></span>
            </div>
          ) : (
            <div key={i} className="ai-bullet">
              <InlineText parts={parseInline(item)} />
            </div>
          )
        )}
      </div>
    );
    listBuf = null;
  };

  lines.forEach((rawLine, i) => {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed === '') {
      flushList(i);
      return;
    }

    const title = sectionTitle(trimmed);
    if (title !== null) {
      flushList(i);
      blocks.push(
        <div key={`sec-${i}`} className="ai-section">
          <span>{title}</span>
        </div>
      );
      return;
    }

    if (trimmed === '---' || trimmed === '***') {
      flushList(i);
      blocks.push(<hr key={`hr-${i}`} />);
      return;
    }

    const bullet = trimmed.match(/^[-•]\s+(.*)/);
    const numbered = trimmed.match(/^\d+[.、)]\s*(.*)/);
    if (bullet || numbered) {
      const ordered = !!numbered;
      const item = (bullet ? bullet[1] : numbered![1]) ?? '';
      if (listBuf && listBuf.ordered === ordered) {
        listBuf.items.push(item);
      } else {
        flushList(i);
        listBuf = { ordered, items: [item] };
      }
      return;
    }

    flushList(i);

    const quote = trimmed.match(/^>\s?(.*)/);
    if (quote) {
      blocks.push(
        <blockquote key={`q-${i}`}>
          <InlineText parts={parseInline(quote[1] ?? '')} />
        </blockquote>
      );
      return;
    }

    blocks.push(
      <p key={`p-${i}`}>
        <InlineText parts={parseInline(trimmed)} />
      </p>
    );
  });
  flushList(lines.length);

  return (
    <div className="ai-content">
      {blocks}
      {streaming && <span className="ai-cursor" />}
    </div>
  );
}
