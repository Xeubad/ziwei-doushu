'use client';
import { motion } from 'framer-motion';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { detectPatterns } from '@/lib/ziwei/patterns-core';

// 格局等级色：统一走 --lv-* 语义 token（与 ChartSummary 同一映射）
const LevelColor: Record<string, string> = {
  excellent: 'var(--lv-excellent)',
  good:      'var(--lv-good)',
  neutral:   'var(--lv-neutral)',
  caution:   'var(--lv-caution)',
};

export default function PatternsCard({ chart }: { chart: ZiweiChart }) {
  const patterns = detectPatterns(chart);
  if (patterns.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card-glass rounded-xl p-4 mb-4"
    >
      <div className="text-[10px] tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--t-faint)' }}>
        <span style={{ color: 'var(--t-gold)', opacity: 0.6 }}>◉</span>
        格局识别（严格古书条件）
        <span className="text-[9px] ml-auto" style={{ color: 'var(--t-faint)', opacity: 0.75 }}>{patterns.length}个</span>
      </div>
      <div className="space-y-2">
        {patterns.map((p, i) => {
          const lv = LevelColor[p.level] ?? 'var(--lv-neutral)';
          return (
            <motion.div
              key={`${p.name}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card-inner rounded-lg p-3"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: lv }} />
                <span className="text-[11px] font-medium" style={{ color: lv }}>{p.name}</span>
                <div className="flex gap-1 ml-auto">
                  {p.palaces.slice(0, 2).map((pa, pi) => (
                    <span
                      key={`${pa}-${pi}`}
                      className="text-[8px] px-1.5 py-px rounded-full border"
                      style={{
                        color: lv,
                        background: `color-mix(in srgb, ${lv} 10%, transparent)`,
                        borderColor: `color-mix(in srgb, ${lv} 25%, transparent)`,
                      }}
                    >
                      {pa.replace('宫', '')}
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-[10px] leading-relaxed pl-3.5" style={{ color: 'var(--t-text2)' }}>
                {p.description}
              </p>

              {p.conditions && (
                <div className="mt-2 pl-3.5 space-y-0.5">
                  {p.conditions.required.length > 0 && (
                    <div className="text-[9px] leading-relaxed" style={{ color: 'var(--t-text2)', opacity: 0.85 }}>
                      <span className="font-medium" style={{ color: 'var(--t-gold)' }}>必须</span>
                      <span style={{ opacity: 0.6 }}> · </span>
                      {p.conditions.required.join('、')}
                    </div>
                  )}
                  {p.conditions.bonus && p.conditions.bonus.length > 0 && (
                    <div className="text-[9px] leading-relaxed" style={{ color: 'var(--t-text2)', opacity: 0.85 }}>
                      <span className="font-medium" style={{ color: 'var(--lu)' }}>加分</span>
                      <span style={{ opacity: 0.6 }}> · </span>
                      {p.conditions.bonus.join('、')}
                    </div>
                  )}
                  {p.conditions.breaking && p.conditions.breaking.length > 0 && (
                    <div className="text-[9px] leading-relaxed" style={{ color: 'var(--t-text2)', opacity: 0.85 }}>
                      <span className="font-medium" style={{ color: 'var(--lv-caution)' }}>破格</span>
                      <span style={{ opacity: 0.6 }}> · </span>
                      {p.conditions.breaking.join('、')}
                    </div>
                  )}
                </div>
              )}

              {p.source && (
                <div className="text-[9px] mt-1.5 pl-3.5" style={{ color: 'var(--t-faint)', opacity: 0.5 }}>
                  出处 · {p.source}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
