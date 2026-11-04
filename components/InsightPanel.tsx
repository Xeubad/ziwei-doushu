'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ZiweiChart, Palace } from '@/lib/ziwei/types';
import type { TimeView } from './TimeNav';
import AiContent from './AiContent';
import { useInsightChat } from './insight/useInsightChat';
import { useInsightInjection, type SelectedSiHua } from './insight/useInsightInjection';
import { TOPICS, TOPIC_PROMPTS, type TopicKey } from './insight/prompts';

export type { SelectedSiHua };

interface InsightPanelProps {
  chart: ZiweiChart;
  selectedPalace?: Palace | null;
  selectedSiHua?: SelectedSiHua | null;
  /** 本地续聊的存储 key（生辰指纹）；不传则不持久化 */
  persistKey?: string;
  /** 分享只读模式：展示分析快照，禁用一切 AI 请求（不传=正常模式） */
  readOnlyAnalyses?: string[];
  /** 当前可分享的分析快照（assistant 内容）变化时通知父级 */
  onAnalysesChange?: (analyses: string[]) => void;
}

export default function InsightPanel({
  chart, selectedPalace, selectedSiHua, persistKey, readOnlyAnalyses, onAnalysesChange,
}: InsightPanelProps) {
  const readOnly = readOnlyAnalyses !== undefined;
  const [activeTopic, setActiveTopic] = useState<TopicKey>('overview');

  const { messages, loading, input, setInput, sendMessage, scrollRef } = useInsightChat({
    chart, persistKey, readOnly, onAnalysesChange,
  });
  useInsightInjection({ chart, selectedPalace, selectedSiHua, readOnly, sendMessage });

  const handleTopicClick = (topicKey: TopicKey) => {
    if (loading) return;
    setActiveTopic(topicKey);
    sendMessage(TOPIC_PROMPTS[topicKey], true);
  };

  const handleSend = () => sendMessage(input);

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden card-glass">

      {/* ── 面板标题 ── */}
      <div
        className="flex-shrink-0 px-3 pt-2.5 pb-2 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--t-border)' }}
      >
        <div className="flex items-center gap-1.5">
          <span style={{ color: 'var(--t-gold)', opacity: 0.5, fontSize: 11 }}>✦</span>
          <span className="text-[10px] tracking-[0.25em] font-medium" style={{ color: 'var(--t-gold)' }}>
            AI 命理解读
          </span>
        </div>
        {readOnly ? (
          <span
            className="text-[9px] px-2 py-0.5 rounded-full"
            style={{ color: 'var(--ac-dim)', border: '1px solid var(--ac-bdr)', background: 'var(--ac-bg)' }}
          >
            分享视图 · 仅供查看
          </span>
        ) : (
          <span className="text-[9px]" style={{ color: 'var(--t-faint)' }}>倪海厦《天纪》体系</span>
        )}
      </div>

      {/* ── Topic buttons（只读分享视图不显示，避免任何 AI 请求）── */}
      {!readOnly && (
        <div className="flex-shrink-0 px-2 pt-2.5 pb-2" style={{ borderBottom: '1px solid var(--t-border)' }}>
          <div className="grid grid-cols-6 gap-1">
            {TOPICS.map(t => {
              const isActive = activeTopic === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => handleTopicClick(t.key)}
                  disabled={loading}
                  className="py-1.5 text-[10px] font-medium rounded-lg transition-all duration-150 disabled:opacity-40"
                  style={{
                    background: isActive ? 'rgba(212,168,67,0.12)' : 'transparent',
                    border: `1px solid ${isActive ? 'rgba(212,168,67,0.3)' : 'var(--t-border)'}`,
                    color: isActive ? 'var(--t-gold)' : 'var(--t-faint)',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

        {readOnly ? (
          /* 分享视图：只展示分析快照，不发起任何请求 */
          <div className="space-y-5">
            {readOnlyAnalyses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                <div className="text-4xl" style={{ color: 'var(--t-gold)', opacity: 0.12 }}>✦</div>
                <p className="text-[11px]" style={{ color: 'var(--t-faint)' }}>分享者暂未附上 AI 解读</p>
                <p className="text-[10px]" style={{ color: 'var(--t-faint)', opacity: 0.8 }}>可以浏览盘面，或自己起一张盘获取解读</p>
              </div>
            ) : (
              readOnlyAnalyses.map((text, i) => (
                <div key={i}>
                  <div className="text-[9px] tracking-widest mb-2 flex items-center gap-1.5" style={{ color: 'var(--t-faint)' }}>
                    <span style={{ color: 'var(--t-gold)', opacity: 0.4 }}>✦</span>
                    命理解读 · 分享快照 {i + 1}/{readOnlyAnalyses.length}
                  </div>
                  <AiContent text={text} />
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            {/* Loading state before first message */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-4xl mb-3" style={{ color: 'var(--t-gold)', opacity: 0.1 }}>✦</div>
                <p className="text-[10px] animate-pulse" style={{ color: 'var(--t-faint)' }}>命格解读生成中…</p>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg, i) => {
                if (msg.role === 'user' && msg.hidden) return null;

                if (msg.role === 'user') {
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-end"
                    >
                      <div
                        className="max-w-[85%] rounded-xl px-3 py-2 text-[11px]"
                        style={{
                          background: 'rgba(212,168,67,0.08)',
                          border: '1px solid rgba(212,168,67,0.18)',
                          color: 'var(--t-gold)',
                        }}
                      >
                        {msg.content}
                      </div>
                    </motion.div>
                  );
                }

                // Assistant message
                const isLastMsg = i === messages.length - 1;

                // 错误提示：警示卡样式，与命理解读区分
                if (msg.isError) {
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl px-3 py-2.5 text-[11px] leading-relaxed"
                      style={{
                        background: 'var(--ac-bg)',
                        border: '1px solid var(--ac-bdr)',
                        color: 'var(--tx-2)',
                      }}
                    >
                      <div className="flex items-start gap-1.5">
                        <span style={{ color: 'var(--ac)' }}>⚠</span>
                        <span>{msg.content}</span>
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div
                      className="text-[9px] tracking-widest mb-2 flex items-center gap-1.5"
                      style={{ color: 'var(--t-faint)' }}
                    >
                      <span style={{ color: 'var(--t-gold)', opacity: 0.4 }}>✦</span>
                      命理解读
                    </div>
                    <AiContent text={msg.content} streaming={loading && isLastMsg} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* ── Input / 只读提示 ── */}
      {readOnly ? (
        <div className="flex-shrink-0 px-3 pb-3 pt-2.5" style={{ borderTop: '1px solid var(--t-border)' }}>
          <div className="flex items-center justify-center gap-1.5 text-[10px] flex-wrap" style={{ color: 'var(--t-faint)' }}>
            <span style={{ color: 'var(--t-gold)', opacity: 0.5 }}>✦</span>
            分享视图不可追问 · 想看自己的命盘？
            <a href="/chart" style={{ color: 'var(--ac-dim)', textDecoration: 'none' }}>去排盘 →</a>
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 px-3 pb-3 pt-2" style={{ borderTop: '1px solid var(--t-border)' }}>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="继续追问，如：今年适合换工作吗？"
              disabled={loading}
              className="flex-1 rounded-lg px-3 py-2 text-[11px] focus:outline-none transition-colors"
              style={{
                background: 'var(--t-card)',
                border: '1px solid var(--t-border)',
                color: 'var(--t-text)',
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-3 py-2 rounded-lg text-[11px] font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: 'rgba(212,168,67,0.15)',
                border: '1px solid rgba(212,168,67,0.25)',
                color: 'var(--t-gold)',
              }}
            >
              {loading ? '…' : '追问'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
