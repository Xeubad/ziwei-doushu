'use client';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { BRANCHES, STEMS } from '@/lib/ziwei/constants';
import { detectPatterns, getMingGongSummary } from '@/lib/ziwei/patterns-core';

interface ChartSummaryProps {
  chart: ZiweiChart;
}

// 格局等级色：统一走 --lv-* 语义 token（globals.css 亮暗两套），不再用 Tailwind 硬编码
const PatternLevelStyle: Record<string, { color: string }> = {
  excellent: { color: 'var(--lv-excellent)' },
  good:      { color: 'var(--lv-good)' },
  neutral:   { color: 'var(--lv-neutral)' },
  caution:   { color: 'var(--lv-caution)' },
};

export default function ChartSummary({ chart }: ChartSummaryProps) {
  const patterns = detectPatterns(chart);
  const { stars: mingStars, keywords, nature } = getMingGongSummary(chart);
  const currentDx = chart.daXians[chart.currentDaXianIndex];

  const siHuaSummary: { name: string; siHua: string; palaceName: string }[] = [];
  for (const palace of chart.palaces) {
    for (const star of palace.stars) {
      if (star.siHua) {
        siHuaSummary.push({ name: star.name, siHua: star.siHua, palaceName: palace.name });
      }
    }
  }
  const siHuaOrder = ['禄', '权', '科', '忌'];
  siHuaSummary.sort((a, b) => siHuaOrder.indexOf(a.siHua) - siHuaOrder.indexOf(b.siHua));

  return (
    <div
      className="anim-fade-in space-y-4"
      style={{ animationDelay: '0.3s' }}
    >
      {/* ── 命格总览 ── */}
      <div
        className="anim-fade-up"
        style={{ animationDelay: '0.35s' }}
      >
      <div className="card-glass rounded-xl p-5">
        <div className="text-[10px] tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--t-faint)' }}>
          <span style={{ color: 'var(--t-gold)', opacity: 0.6 }}>✦</span>
          命格总览
        </div>

        <div className="flex flex-wrap items-start gap-4">
          <div>
            <div className="text-[9px] mb-1.5" style={{ color: 'var(--t-faint)', opacity: 0.85 }}>命宫主星</div>
            <div className="flex items-center gap-1">
              {mingStars.length > 0 ? (
                mingStars.map(s => (
                  <span key={s} className="font-bold text-lg" style={{ color: 'var(--t-gold)' }}>{s}</span>
                ))
              ) : (
                <span className="text-sm" style={{ color: 'var(--t-faint)' }}>空宫</span>
              )}
            </div>
            {nature && (
              <div className="text-[10px] mt-1" style={{ color: 'var(--t-gold)', opacity: 0.5 }}>{nature}</div>
            )}
          </div>

          {keywords.length > 0 && (
            <div>
              <div className="text-[9px] mb-1.5" style={{ color: 'var(--t-faint)', opacity: 0.85 }}>性格特质</div>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map(k => (
                  <span key={k} className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{
                      color: 'var(--t-gold)',
                      background: 'rgba(212,168,67,0.08)',
                      border: '1px solid rgba(212,168,67,0.15)',
                    }}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="ml-auto text-right">
            <div className="text-[9px] mb-1" style={{ color: 'var(--t-faint)', opacity: 0.85 }}>五行局 · 当前大限</div>
            <div className="text-[11px]" style={{ color: 'var(--t-text2)' }}>{chart.wuxingJuName}</div>
            {currentDx && (
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--dx)' }}>
                {currentDx.startAge}~{currentDx.endAge}岁 · {currentDx.palaceName}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px]"
          style={{ borderTop: '1px solid var(--t-border)', color: 'var(--t-faint)' }}>
          <span>公历 {chart.birthInfo.year}-{chart.birthInfo.month}-{chart.birthInfo.day}</span>
          <span>
            农历 {chart.lunarInfo.lunarYear}年{chart.lunarInfo.isLeapMonth ? '闰' : ''}
            {chart.lunarInfo.lunarMonth}月{chart.lunarInfo.lunarDay}日
          </span>
          <span>{STEMS[chart.lunarInfo.yearStem]}{BRANCHES[chart.lunarInfo.yearBranch]}年 · {BRANCHES[chart.birthInfo.hour]}时</span>
          <span>命宫{BRANCHES[chart.mingGongBranch]} · 身宫{BRANCHES[chart.shenGongBranch]}</span>
        </div>
      </div>
      </div>

      {/* ── 本命四化 ── */}
      {siHuaSummary.length > 0 && (
        <div
          className="anim-fade-up"
          style={{ animationDelay: '0.55s' }}
        >
        <div className="card-glass rounded-xl p-4">
          <div className="text-[10px] tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--t-faint)' }}>
            <span style={{ color: 'var(--t-gold)', opacity: 0.6 }}>◆</span>
            本命四化
          </div>
          <div className="grid grid-cols-2 gap-2">
            {siHuaSummary.map(({ name, siHua, palaceName }) => {
              const colors: Record<string, string> = {
                '禄': 'var(--lu)', '权': 'var(--quan)', '科': 'var(--ke)', '忌': 'var(--ji)',
              };
              const lv = colors[siHua] || 'var(--lu)';
              const c = {
                text: lv,
                bg: `color-mix(in srgb, ${lv} 6%, transparent)`,
                border: `color-mix(in srgb, ${lv} 20%, transparent)`,
              };
              return (
                <div key={name + siHua}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-[10px]"
                  style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
                >
                  <span className="font-medium">{name}</span>
                  <div className="flex items-center gap-1.5 text-right">
                    <span style={{ opacity: 0.6 }} className="text-[9px]">{palaceName.replace('宫', '')}</span>
                    <span className="font-bold">化{siHua}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      )}

      {/* ── 格局识别 ── */}
      {patterns.length > 0 && (
        <div
          className="anim-fade-up"
          style={{ animationDelay: '0.72s' }}
        >
        <div className="card-glass rounded-xl p-4">
          <div className="text-[10px] tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--t-faint)' }}>
            <span style={{ color: 'var(--t-gold)', opacity: 0.6 }}>◉</span>
            格局识别
            <span className="text-[9px] ml-auto" style={{ color: 'var(--t-faint)', opacity: 0.75 }}>{patterns.length}个格局</span>
          </div>
          <div className="space-y-2">
            {patterns.map((p, i) => {
              const lv = PatternLevelStyle[p.level]?.color ?? 'var(--lv-neutral)';
              return (
                <div
                  key={i}
                  className="anim-slide-left card-inner rounded-lg p-3"
                  style={{ animationDelay: `${0.8 + i * 0.08}s` }}
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
                </div>
              );
            })}
          </div>
        </div>
        </div>
      )}

      {/* ── 大限运程 ── */}
      <div
        className="anim-fade-up"
        style={{ animationDelay: '0.88s' }}
      >
      <div className="card-glass rounded-xl p-4">
        <div className="text-[10px] tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--t-faint)' }}>
          <span style={{ color: 'var(--dx)', opacity: 0.6 }}>◎</span>
          大限运程
        </div>
        <div className="grid grid-cols-3 gap-2">
          {chart.daXians.slice(0, 9).map((dx, i) => {
            const isCurrent = i === chart.currentDaXianIndex;
            return (
              <div
                key={i}
                className="text-[10px] px-2 py-2 rounded-lg text-center transition-colors"
                style={{
                  border: isCurrent
                    ? '1px solid color-mix(in srgb, var(--dx) 40%, transparent)'
                    : '1px solid var(--t-border)',
                  background: isCurrent ? 'color-mix(in srgb, var(--dx) 8%, transparent)' : 'transparent',
                  color: isCurrent ? 'var(--dx)' : 'var(--t-faint)',
                }}
              >
                <div className="font-mono tabular-nums">{dx.startAge}~{dx.endAge}</div>
                <div className="text-[9px] mt-0.5" style={{ opacity: 0.7 }}>{dx.palaceName.replace('宫', '')}</div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
