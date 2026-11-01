'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import ChartSummary from '@/components/ChartSummary';
import InsightPanel from '@/components/InsightPanel';
import StarDetailPanel from '@/components/StarDetailPanel';
import ShareChartDialog from '@/components/ShareChartDialog';
import type { TimeView } from '@/components/TimeNav';
import { generateChart } from '@/lib/ziwei/algorithm';
import { BRANCHES } from '@/lib/ziwei/constants';
import { decodeShareCode, birthKey } from '@/lib/ziwei/share-codec';
import type { BirthInfo, ZiweiChart, Palace, Star } from '@/lib/ziwei/types';

/**
 * 命盘页 —— 命盘工作台
 *
 * 左侧命盘（本命 / 大限 / 流年切换、三方四正联动），右侧 AI 解读面板：
 * 点宫位 → 宫位分析；点叠加四化 badge → 飞化分析；顶部话题卡切换主题。
 *
 * 分享：`/chart?d=<分享码>` 打开的是只读分享视图（盘面 + AI 分析快照，
 * 不含发起人提问记录，不能继续对话）；发起人自己的对话存在 localStorage，
 * 下次打开同一命盘自动恢复。
 */

interface SelectedSiHua {
  starName: string;
  siHua: string;
  view: TimeView;
}

const RECENT_KEY = 'ziwei-last-chart';

export default function ChartPage() {
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [selectedSiHua, setSelectedSiHua] = useState<SelectedSiHua | null>(null);
  const [selectedStar, setSelectedStar] = useState<{ star: Star; palaceName: string } | null>(null);

  // 分享相关状态
  const [sharedAnalyses, setSharedAnalyses] = useState<string[] | null>(null); // 非 null = 只读分享视图
  const [analyses, setAnalyses] = useState<string[]>([]); // 发起人当前可分享的分析快照
  const [shareOpen, setShareOpen] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [recent, setRecent] = useState<BirthInfo | null>(null);

  // 挂在最前：读取分享链接 / 最近命盘（hooks 不能放进条件分支）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) {
        const b = JSON.parse(raw) as BirthInfo;
        if (b && typeof b.year === 'number' && typeof b.month === 'number' && typeof b.day === 'number') {
          setRecent(b);
        }
      }
    } catch { /* 忽略损坏记录 */ }

    const code = new URLSearchParams(window.location.search).get('d');
    if (!code) return;
    const decoded = decodeShareCode(code);
    if (!decoded) {
      setShareError('分享码无效或已损坏，请向分享者重新获取。');
      return;
    }
    try {
      setChart(generateChart(decoded.birthInfo));
      setSharedAnalyses(decoded.analyses);
    } catch {
      setShareError('分享码中的命盘数据有误，无法还原盘面。');
    }
  }, []);

  const onAnalysesChange = useCallback((a: string[]) => setAnalyses(a), []);

  const clearShareUrl = () => {
    if (window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  // 从表单起盘（或继续上次）
  const enterChart = (info: BirthInfo) => {
    setChart(generateChart(info));
    setSelectedPalace(null);
    setSelectedSiHua(null);
    setSelectedStar(null);
    setSharedAnalyses(null);
    setAnalyses([]);
    clearShareUrl();
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(info)); } catch { /* 忽略 */ }
  };

  const reset = () => {
    setChart(null);
    setSelectedPalace(null);
    setSelectedSiHua(null);
    setSelectedStar(null);
    setSharedAnalyses(null);
    setAnalyses([]);
    clearShareUrl();
  };

  const isSharedView = sharedAnalyses !== null;

  // ── 未起盘：出生信息表单 ──
  if (!chart) {
    return (
      <main className="container-page" style={{ maxWidth: 720, paddingTop: 56, paddingBottom: 80 }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ textAlign: 'center', marginBottom: 36 }}
        >
          <div className="label-section" style={{ marginBottom: 12 }}>Zi Wei Dou Shu</div>
          <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--tx-0)', marginBottom: 12 }}>
            紫微斗数排盘
          </h1>
          <p style={{ color: 'var(--tx-2)', fontSize: 14, lineHeight: 1.9, maxWidth: 480, margin: '0 auto' }}>
            输入出生年月日时，开源排盘引擎即时生成命盘，
            并由 AI 从倪海厦《天纪》体系解读格局、大限与运势。
          </p>

          {shareError && (
            <div
              className="mt-5 mx-auto text-[12px] rounded-xl px-4 py-3"
              style={{ maxWidth: 480, background: 'var(--ac-bg)', border: '1px solid var(--ac-bdr)', color: 'var(--tx-2)' }}
            >
              ⚠ {shareError}
            </div>
          )}

          {recent && (
            <button
              type="button"
              onClick={() => enterChart(recent)}
              className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] transition-colors"
              style={{ border: '1px solid var(--bdr-med)', background: 'transparent', color: 'var(--tx-2)', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ac-bdr)'; e.currentTarget.style.color = 'var(--ac)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bdr-med)'; e.currentTarget.style.color = 'var(--tx-2)'; }}
            >
              ↻ 继续上次：{recent.year}-{String(recent.month).padStart(2, '0')}-{String(recent.day).padStart(2, '0')} {BRANCHES[recent.hour]}时 {recent.gender === 'male' ? '男' : '女'}
            </button>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
        >
          <BirthForm onSubmit={enterChart} />
        </motion.div>

        <p style={{ textAlign: 'center', color: 'var(--tx-3)', fontSize: 12, lineHeight: 1.8, marginTop: 24 }}>
          排盘在浏览器本地完成，不需要任何 API Key。<br />
          AI 解读需要服务端配置模型 Key（见 README「快速开始」）。
        </p>
      </main>
    );
  }

  // ── 已起盘：命盘工作台 ──
  const { birthInfo, lunarInfo } = chart;
  const summary = [
    birthInfo.name || (birthInfo.gender === 'male' ? '乾造' : '坤造'),
    `公历 ${birthInfo.year}-${String(birthInfo.month).padStart(2, '0')}-${String(birthInfo.day).padStart(2, '0')} ${BRANCHES[birthInfo.hour]}时`,
    `农历 ${lunarInfo.lunarYear}年${lunarInfo.isLeapMonth ? '闰' : ''}${lunarInfo.lunarMonth}月${lunarInfo.lunarDay}日`,
    lunarInfo.fourPillars ? `四柱 ${lunarInfo.fourPillars.join(' ')}` : null,
    `虚岁 ${chart.currentAge}`,
  ].filter(Boolean) as string[];

  return (
    <main className="chart-page-root">
      {/* ── 顶栏：返回 + 命盘信息 + 分享 ── */}
      <header className="chart-topbar">
        <button
          type="button"
          className="chart-topbar-back"
          onClick={reset}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
            background: 'transparent', border: 'none', padding: '4px 6px',
            fontSize: 13, color: 'var(--tx-2)', borderRadius: 'var(--r-sm)',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--ac)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--tx-2)'; }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>‹</span>
          {isSharedView ? '自己排一张' : '重新起盘'}
        </button>
        <div className="chart-topbar-back-sep" />
        <div className="chart-topbar-tabs" style={{ gap: 10, overflow: 'hidden' }}>
          {summary.map((item, i) => (
            <span
              key={i}
              style={{
                fontSize: 11, color: i === 0 ? 'var(--ac)' : 'var(--tx-3)',
                whiteSpace: 'nowrap', letterSpacing: i === 0 ? '0.12em' : '0.02em',
              }}
            >
              {item}
            </span>
          ))}
        </div>

        {/* 分享按钮（只读分享视图不显示） */}
        {!isSharedView && (
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="chart-topbar-export"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 'var(--r-pill)',
              border: '1px solid var(--ac-bdr)', background: 'var(--ac-bg)',
              // 亮色主题下 --ac 在浅金底上对比度不足，用 --ac-dim（暗金/亮金随主题翻转）
              color: 'var(--ac-dim)', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,168,67,0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--ac-bg)'; }}
          >
            <span style={{ fontSize: 12 }}>⤴</span>
            分享此盘
          </button>
        )}
      </header>

      {/* ── 工作台：命盘 + AI 解读 ── */}
      <div className="chart-workspace">
        <div className="chart-workspace-left">
          <ChartBoard
            chart={chart}
            onPalaceSelect={setSelectedPalace}
            onStarSelect={(star, palace) => setSelectedStar({ star, palaceName: palace.name })}
            onSiHuaClick={(starName, siHua, view) => setSelectedSiHua({ starName, siHua, view })}
          />
          <div style={{ marginTop: 20 }}>
            <ChartSummary chart={chart} />
          </div>
        </div>
        <div className="chart-workspace-right">
          <div className="insight-panel-root">
            <InsightPanel
              chart={chart}
              selectedPalace={isSharedView ? null : selectedPalace}
              selectedSiHua={isSharedView ? null : selectedSiHua}
              persistKey={isSharedView ? undefined : birthKey(birthInfo)}
              readOnlyAnalyses={isSharedView ? sharedAnalyses! : undefined}
              onAnalysesChange={isSharedView ? undefined : onAnalysesChange}
            />
          </div>
        </div>
      </div>

      {/* ── 星曜详情抽屉 ── */}
      {selectedStar && (
        <div className="star-drawer">
          <StarDetailPanel
            star={selectedStar.star}
            palaceName={selectedStar.palaceName}
            onClose={() => setSelectedStar(null)}
          />
        </div>
      )}

      {/* ── 分享弹窗 ── */}
      <ShareChartDialog
        open={shareOpen}
        birthInfo={birthInfo}
        analyses={analyses}
        onClose={() => setShareOpen(false)}
      />
    </main>
  );
}
