/**
 * components/insight/useInsightInjection —— 命盘交互联动注入
 *
 * 点宫位 → 宫位分析 prompt；点叠加四化 badge → 飞化分析 prompt。
 * 同一宫位/四化连续点击不重复注入（ref 记录上次）。
 */

import { useRef, useEffect } from 'react';
import type { ZiweiChart, Palace } from '@/lib/ziwei/types';
import type { TimeView } from '../TimeNav';
import { buildPalacePrompt, buildSiHuaPrompt } from './prompts';

export interface SelectedSiHua {
  starName: string;
  siHua: string;
  view: TimeView;
}

interface UseInsightInjectionOptions {
  chart: ZiweiChart;
  selectedPalace?: Palace | null;
  selectedSiHua?: SelectedSiHua | null;
  readOnly?: boolean;
  sendMessage: (text: string, hidden?: boolean) => void;
}

export function useInsightInjection({
  chart, selectedPalace, selectedSiHua, readOnly = false, sendMessage,
}: UseInsightInjectionOptions) {
  const lastPalaceBranch = useRef<number | undefined>(undefined);
  const lastSiHuaKey = useRef<string | undefined>(undefined);

  // 宫位选中 → 宫位分析
  useEffect(() => {
    if (readOnly) return;
    if (!selectedPalace || selectedPalace.branch === lastPalaceBranch.current) return;
    lastPalaceBranch.current = selectedPalace.branch;
    sendMessage(buildPalacePrompt(selectedPalace), true);
  }, [selectedPalace, readOnly, sendMessage]);

  // 四化 badge 点击 → 飞化分析
  useEffect(() => {
    if (readOnly || !selectedSiHua) return;
    const key = `${selectedSiHua.starName}-${selectedSiHua.siHua}-${selectedSiHua.view}`;
    if (key === lastSiHuaKey.current) return;
    lastSiHuaKey.current = key;

    const palaceOfStar = chart.palaces.find(p =>
      p.stars.some(s => s.name === selectedSiHua.starName)
    );
    sendMessage(
      buildSiHuaPrompt(selectedSiHua.starName, selectedSiHua.siHua, selectedSiHua.view, palaceOfStar?.name ?? '未知宫位'),
      true,
    );
  }, [selectedSiHua, readOnly, sendMessage, chart]);
}
