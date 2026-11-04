'use client';

/**
 * components/ShareChartDialog —— 生成 / 复制命盘分享码
 *
 * 分享码内容：生辰（重建盘面）+ AI 分析快照（不含提问记录、不含对话能力）。
 * 接收方打开链接只能看（盘面 + 分析），不能继续问 AI。
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { encodeShareCode } from '@/lib/ziwei/share-codec';
import { SITE_URL } from '@/lib/site';
import { BRANCHES } from '@/lib/ziwei/constants';
import type { BirthInfo } from '@/lib/ziwei/types';

interface ShareChartDialogProps {
  open: boolean;
  birthInfo: BirthInfo;
  analyses: string[];
  onClose: () => void;
}

export default function ShareChartDialog({ open, birthInfo, analyses, onClose }: ShareChartDialogProps) {
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [code, setCode] = useState('');
  const [link, setLink] = useState('');

  // 编码是异步（gzip + crc32）：打开弹窗时生成，关闭时清空
  useEffect(() => {
    if (!open) { setCode(''); setLink(''); return; }
    let cancelled = false;
    encodeShareCode({ birthInfo, analyses }).then(c => {
      if (cancelled) return;
      // 用运行时域名生成分享链接：Docker 部署换域名无需重新构建镜像
      const origin = typeof window !== 'undefined' ? window.location.origin : SITE_URL;
      setCode(c);
      setLink(`${origin}/chart?d=${c}`);
    });
    return () => { cancelled = true; };
  }, [open, birthInfo, analyses]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const copy = async (text: string, target: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(target);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // 剪贴板不可用（旧浏览器 / 非 https）：提示手动复制
      window.prompt('请手动复制：', text);
    }
  };

  const dateText = `${birthInfo.year}-${String(birthInfo.month).padStart(2, '0')}-${String(birthInfo.day).padStart(2, '0')} ${BRANCHES[birthInfo.hour]}时 ${birthInfo.gender === 'male' ? '男' : '女'}`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--bdr-med)', boxShadow: 'var(--sh-lg)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 标题 */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--bdr)' }}>
              <div>
                <div className="text-[10px] tracking-[0.25em]" style={{ color: 'var(--ac-dim)' }}>SHARE</div>
                <h3 className="text-[15px] font-semibold mt-0.5" style={{ color: 'var(--tx-0)' }}>分享此命盘</h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-lg leading-none"
                style={{ color: 'var(--tx-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-[12px] leading-relaxed" style={{ color: 'var(--tx-2)' }}>
                分享内容：<strong style={{ color: 'var(--tx-0)' }}>命盘（{dateText}）</strong>
                {analyses.length > 0
                  ? ` + 已生成的 ${analyses.length} 条 AI 分析快照`
                  : '（暂无 AI 分析，建议先生成解读再分享）'}
                。<span style={{ color: 'var(--tx-3)' }}>不含你的提问记录；对方只能查看，不能继续对话。</span>
              </div>

              {/* 链接 */}
              <div>
                <div className="text-[10px] tracking-widest mb-1.5" style={{ color: 'var(--tx-3)' }}>分享链接</div>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={link}
                    onFocus={e => e.currentTarget.select()}
                    className="flex-1 text-[11px] rounded-lg px-3 py-2"
                    style={{ background: 'var(--bg-1)', border: '1px solid var(--bdr)', color: 'var(--tx-1)', outline: 'none' }}
                  />
                  <button
                    onClick={() => copy(link, 'link')}
                    className="flex-shrink-0 px-3 py-2 rounded-lg text-[11px] font-medium"
                    style={{
                      // 金底深字：亮色主题下白字对比度不足，深色字在两种主题下都清晰
                      background: 'var(--ac)', border: 'none', color: '#2a1a00',
                      fontWeight: 600, cursor: 'pointer', minWidth: 64,
                    }}
                  >
                    {copied === 'link' ? '已复制 ✓' : '复制'}
                  </button>
                </div>
              </div>

              {/* 码 */}
              <div>
                <div className="text-[10px] tracking-widest mb-1.5 flex items-center justify-between" style={{ color: 'var(--tx-3)' }}>
                  <span>分享码（{code.length} 字符）</span>
                  <button
                    onClick={() => copy(code, 'code')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--ac-dim)', cursor: 'pointer', fontSize: 10 }}
                  >
                    {copied === 'code' ? '已复制 ✓' : '复制码'}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={code}
                  rows={3}
                  onFocus={e => e.currentTarget.select()}
                  className="w-full text-[10px] rounded-lg px-3 py-2 resize-none"
                  style={{ background: 'var(--bg-1)', border: '1px solid var(--bdr)', color: 'var(--tx-2)', outline: 'none', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}
                />
              </div>

              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--tx-3)' }}>
                ⚠ 分享码是 Base64 编码而非加密，生辰与分析内容可被接收方解码查看；请勿在码中附加姓名等敏感信息。
                码为分享时的快照，之后继续对话不会自动同步。
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
