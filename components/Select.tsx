'use client';

/**
 * components/Select —— 表单下拉选择器（替代原生 <select>）
 *
 * 原生 select 在各平台样式不可控（Windows 深色下拉、macOS 箭头等），
 * 这里用 button + popup 实现统一视觉：圆角 14px、金色高亮选中、
 * 键盘导航（↑↓ 移动 / Enter 选中 / Esc 关闭）、点击外部关闭。
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '@/components/ThemeProvider';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** 错误态：红边框 */
  error?: boolean;
  /** 触发器附加样式（如 grid 中的宽度由外层控制，不需要传） */
  style?: React.CSSProperties;
}

export default function Select({
  value, onChange, options, placeholder, disabled, error, style,
}: SelectProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);
  const label = selected ? selected.label : (placeholder ?? '请选择');

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // 打开时把选中项滚进视野
  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex(o => o.value === value);
    setActiveIndex(idx);
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector('[data-active="true"]')
        ?.scrollIntoView({ block: 'nearest' });
    });
  }, [open, options, value]);

  const commit = useCallback((v: string) => {
    onChange(v);
    setOpen(false);
  }, [onChange]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < options.length) commit(options[activeIndex].value);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex(i => {
        const next = Math.min(Math.max(i + dir, 0), options.length - 1);
        requestAnimationFrame(() => {
          listRef.current
            ?.querySelector(`[data-idx="${next}"]`)
            ?.scrollIntoView({ block: 'nearest' });
        });
        return next;
      });
    }
  };

  // ── 主题配色（与 BirthForm 输入框一致的暖色系）──
  const border = error
    ? (isDark ? '#f87171' : '#dc2626')
    : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(200,160,60,0.25)');
  const bg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,252,240,0.8)';
  const textColor = !selected
    ? (isDark ? 'rgba(190,205,225,0.55)' : 'rgba(140,110,60,0.55)')
    : (isDark ? '#e8eef8' : '#2a1a00');
  const focusBorder = isDark ? 'rgba(212,168,67,0.5)' : 'rgba(180,120,20,0.5)';

  return (
    <div ref={rootRef} style={{ position: 'relative', ...style }}>
      {/* 触发器 */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px 10px 14px',
          borderRadius: '14px',
          fontSize: '13px',
          textAlign: 'left',
          background: bg,
          border: `1px solid ${open ? focusBorder : border}`,
          color: textColor,
          opacity: disabled ? 0.45 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          transition: 'border-color 0.2s, background 0.15s',
          boxShadow: open
            ? `0 0 0 3px ${isDark ? 'rgba(212,168,67,0.12)' : 'rgba(180,120,20,0.10)'}`
            : 'none',
          ...style,
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        {/* 箭头 */}
        <svg
          width="11" height="7" viewBox="0 0 11 7" fill="none"
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
            opacity: 0.55,
          }}
        >
          <path d="M1 1L5.5 5.5L10 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* 弹出层 */}
      {open && (
        <div
          ref={listRef}
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0, right: 0,
            zIndex: 80,
            maxHeight: 240,
            overflowY: 'auto',
            padding: 5,
            borderRadius: '14px',
            background: isDark ? 'rgba(14,22,44,0.98)' : 'rgba(255,253,246,0.98)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(200,160,60,0.28)'}`,
            boxShadow: isDark
              ? '0 16px 40px rgba(0,0,0,0.5)'
              : '0 16px 40px rgba(120,90,20,0.16)',
            backdropFilter: 'blur(12px)',
            scrollbarWidth: 'thin',
          }}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                data-idx={i}
                data-active={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={e => e.preventDefault()} // 防止触发器失焦抢走 click
                onClick={() => commit(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px',
                  borderRadius: '9px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  color: isSelected
                    ? (isDark ? '#e8c060' : '#7a5008')
                    : (isDark ? 'rgba(220,228,240,0.9)' : '#3a2c10'),
                  background: i === activeIndex
                    ? (isDark ? 'rgba(212,168,67,0.12)' : 'rgba(180,120,20,0.08)')
                    : isSelected
                    ? (isDark ? 'rgba(212,168,67,0.08)' : 'rgba(180,120,20,0.05)')
                    : 'transparent',
                  fontWeight: isSelected ? 600 : 400,
                  transition: 'background 0.12s',
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {opt.label}
                </span>
                {isSelected && (
                  <svg width="12" height="9" viewBox="0 0 12 9" fill="none" style={{ flexShrink: 0, opacity: 0.9 }}>
                    <path d="M1 4.5L4.2 7.5L11 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
