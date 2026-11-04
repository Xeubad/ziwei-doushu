'use client';
import { useEffect, useState } from 'react';

interface ScrollIntroProps {
  onComplete: () => void;
  /** 跳过按钮文案 */
  skipLabel?: string;
}

const BEIDOU = ['天枢', '天璇', '天玑', '天权', '玉衡', '开阳', '摇光'];

/** 卷轴展开缓动：先快后慢（卷轴拉开的物理感） */
const UNROLL_EASE = 'cubic-bezier(0.32, 0.72, 0.36, 1)';

export default function ScrollIntro({ onComplete, skipLabel = '跳 过' }: ScrollIntroProps) {
  // closing：整体淡出中（对应原 framer-motion 的 exit 动画）
  // 卷轴展开/内容浮现/印章弹入全部由 CSS animationDelay 排时序，不需要 React state
  const [closing, setClosing] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // 时间序列（与原 framer-motion 编排一致）：
    // 0.0s        : 卷轴杆在中央，纸卷起来（width: 0）
    // 0.3-2.0s   : 卷轴往两侧展开（1.7s）
    // 2.0s        : 内容浮现
    // 2.0-3.5s   : 内容停留 1.5s 给用户欣赏
    // 3.5s        : 整体开始淡出
    // 4.2s        : visible = false，触发 onComplete
    const t1 = setTimeout(() => setClosing(true), 3500);
    const t2 = setTimeout(() => { setVisible(false); onComplete(); }, 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  const handleSkip = () => {
    setClosing(true);
    setTimeout(() => { setVisible(false); onComplete(); }, 700);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'radial-gradient(ellipse at center, #1a120a 0%, #0a0604 70%, #000000 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        animation: closing ? 'kf-intro-out 0.7s ease-in-out forwards' : undefined,
      }}
    >
      {/* 远景星点装饰 */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          radial-gradient(2px 2px at 20% 30%, rgba(255,220,150,0.6), transparent),
          radial-gradient(1px 1px at 70% 20%, rgba(255,220,150,0.4), transparent),
          radial-gradient(1px 1px at 35% 75%, rgba(255,220,150,0.5), transparent),
          radial-gradient(1.5px 1.5px at 85% 65%, rgba(255,220,150,0.4), transparent),
          radial-gradient(1px 1px at 60% 88%, rgba(255,220,150,0.3), transparent),
          radial-gradient(2px 2px at 92% 40%, rgba(255,220,150,0.5), transparent)
        `,
      }} />

      {/* 卷轴主体（从右往左展开 — 右轴固定、纸向左铺、左轴向左移） */}
      <div style={{
        position: 'relative',
        width: 'min(90vw, 1080px)',
        height: 'min(60vh, 480px)',
      }}>
        {/* 宣纸（right 锚定在右轴内侧，width 从 0 → 100% - 左右两轴宽度） */}
        <div
          style={{
            position: 'absolute',
            top: '8%', bottom: '8%',
            right: '16px',
            width: 'calc(100% - 32px)',
            animation: `kf-unroll-w 1.9s ${UNROLL_EASE} both`,
            background: `
              linear-gradient(180deg, rgba(120,80,30,0.08) 0%, transparent 12%, transparent 88%, rgba(120,80,30,0.08) 100%),
              linear-gradient(135deg, #efe1bf 0%, #e8d6ad 50%, #d6c08a 100%)
            `,
            boxShadow: `
              inset 0 0 80px rgba(140,90,30,0.18),
              inset 0 -2px 0 rgba(120,80,30,0.15),
              0 8px 40px rgba(0,0,0,0.7),
              0 16px 60px rgba(80,40,10,0.4)
            `,
            overflow: 'hidden',
          }}
        >
          {/* 上下卷边阴影（仿古卷轴的折痕） */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '8px',
            background: 'linear-gradient(180deg, rgba(80,50,20,0.35), transparent)',
          }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '8px',
            background: 'linear-gradient(0deg, rgba(80,50,20,0.35), transparent)',
          }} />

          {/* 古纸纹理 */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `
              radial-gradient(at 20% 30%, rgba(120,80,30,0.06), transparent 50%),
              radial-gradient(at 80% 70%, rgba(120,80,30,0.05), transparent 50%),
              radial-gradient(at 50% 50%, rgba(120,80,30,0.04), transparent 60%)
            `,
            opacity: 0.7,
          }} />

          {/* 卷轴内容（展开后浮现：纸 1.9s 展开完再淡入） */}
          <div
            style={{
              position: 'relative',
              height: '100%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '0 clamp(40px, 8vw, 120px)',
              fontFamily: '"STSong", "Songti SC", "SimSun", serif',
              animation: 'kf-fade-up 0.8s ease-out 1.9s backwards',
            }}
          >
            {/* 顶部装饰：北斗七星名 */}
            <div style={{
              fontSize: 'clamp(10px, 1.1vw, 12px)',
              color: '#8b5d18',
              letterSpacing: '0.45em',
              marginBottom: 'clamp(20px, 3vh, 36px)',
              fontFamily: '"STKaiti", "Kaiti SC", serif',
              whiteSpace: 'nowrap',
              opacity: 0.85,
            }}>
              {BEIDOU.join(' · ')}
            </div>

            {/* 烫金细线 */}
            <div style={{
              width: '60px', height: '1px',
              background: 'linear-gradient(90deg, transparent, #a87a30, transparent)',
              marginBottom: 'clamp(16px, 2.5vh, 28px)',
            }} />

            {/* 大字「紫微命盘」 */}
            <h1 style={{
              fontSize: 'clamp(48px, 8vw, 110px)',
              fontWeight: 700,
              color: '#1a1208',
              letterSpacing: 'clamp(0.18em, 0.25vw, 0.3em)',
              lineHeight: 1.05,
              margin: 0,
              textShadow: '0 1px 0 rgba(255,250,235,0.3)',
              whiteSpace: 'nowrap',
            }}>
              紫微命盘
            </h1>

            {/* 副标 楷体 */}
            <div style={{
              fontSize: 'clamp(13px, 1.5vw, 18px)',
              color: '#6b4818',
              letterSpacing: '0.4em',
              fontFamily: '"STKaiti", "Kaiti SC", serif',
              marginTop: 'clamp(16px, 2.5vh, 24px)',
              marginBottom: '6px',
              whiteSpace: 'nowrap',
            }}>
              观 天 之 象 · 察 人 之 命
            </div>
            <div style={{
              fontSize: 'clamp(11px, 1.2vw, 14px)',
              color: '#8b6410',
              letterSpacing: '0.3em',
              fontFamily: '"STSong", serif',
              whiteSpace: 'nowrap',
              opacity: 0.85,
            }}>
              倪海厦《天纪》正宗体系
            </div>

            {/* 朱砂方印（内容浮现后再弹入：1.9s 展开 + 0.4s 延迟） */}
            <div
              style={{
                marginTop: 'clamp(20px, 3vh, 32px)',
                width: 'clamp(50px, 6vw, 64px)',
                height: 'clamp(50px, 6vw, 64px)',
                background: '#a8302a',
                color: '#f5ecd7',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: '"STSong", serif',
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: 0,
                boxShadow: '0 2px 6px rgba(0,0,0,0.3), inset 0 0 0 2px rgba(245,236,215,0.15)',
                fontSize: 'clamp(11px, 1.2vw, 13px)',
                animation: `kf-seal-in 0.5s cubic-bezier(0.34,1.56,0.64,1) 2.3s backwards`,
              }}
            >
              <div style={{ display: 'flex', gap: '0' }}><span>王</span><span>多</span></div>
              <div style={{ display: 'flex', gap: '0' }}><span>鱼</span><span>印</span></div>
            </div>

            {/* 底部装饰：八卦 */}
            <div style={{
              marginTop: 'clamp(20px, 3vh, 32px)',
              fontSize: 'clamp(13px, 1.4vw, 16px)',
              color: '#a87a30',
              letterSpacing: '0.6em',
              opacity: 0.7,
              whiteSpace: 'nowrap',
            }}>
              ☰ ☱ ☲ ☳ ☴ ☵ ☶ ☷
            </div>
          </div>
        </div>

        {/* 右卷轴杆（固定不动，是收纳卷轴的母轴） */}
        <div
          style={{
            position: 'absolute', top: 0, bottom: 0, right: 0,
            width: '32px',
            background: 'linear-gradient(90deg, #4a2f0e 0%, #8b5d18 25%, #c89647 50%, #8b5d18 75%, #4a2f0e 100%)',
            borderRadius: '4px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.7), inset 0 0 12px rgba(0,0,0,0.4)',
            zIndex: 2,
          }}
        >
          {/* 上端铜玉帽 */}
          <div style={{
            position: 'absolute', top: '-14px', left: '-6px', right: '-6px',
            height: '20px',
            background: 'radial-gradient(ellipse at 30% 30%, #f0d090 0%, #c89647 35%, #6a4218 90%)',
            borderRadius: '50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute', bottom: '-14px', left: '-6px', right: '-6px',
            height: '20px',
            background: 'radial-gradient(ellipse at 30% 30%, #f0d090 0%, #c89647 35%, #6a4218 90%)',
            borderRadius: '50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }} />
        </div>

        {/* 左卷轴杆（从右轴位置出发，向左拉开 — 这是被「拉」的那根） */}
        <div
          style={{
            position: 'absolute', top: 0, bottom: 0,
            right: 'calc(100% - 32px)',
            width: '32px',
            background: 'linear-gradient(90deg, #4a2f0e 0%, #8b5d18 25%, #c89647 50%, #8b5d18 75%, #4a2f0e 100%)',
            borderRadius: '4px',
            boxShadow: '-2px 6px 24px rgba(0,0,0,0.7), inset 0 0 12px rgba(0,0,0,0.4)',
            zIndex: 3,
            animation: `kf-unroll-pos 1.9s ${UNROLL_EASE} both`,
          }}
        >
          <div style={{
            position: 'absolute', top: '-14px', left: '-6px', right: '-6px',
            height: '20px',
            background: 'radial-gradient(ellipse at 30% 30%, #f0d090 0%, #c89647 35%, #6a4218 90%)',
            borderRadius: '50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute', bottom: '-14px', left: '-6px', right: '-6px',
            height: '20px',
            background: 'radial-gradient(ellipse at 30% 30%, #f0d090 0%, #c89647 35%, #6a4218 90%)',
            borderRadius: '50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }} />
        </div>
      </div>

      {/* 跳过按钮 */}
      <button
        onClick={handleSkip}
        style={{
          position: 'absolute', bottom: '32px', right: '32px',
          padding: '8px 18px',
          background: 'transparent',
          color: 'rgba(232,220,196,0.55)',
          border: '1px solid rgba(232,220,196,0.18)',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
          fontFamily: '"STSong", serif',
          letterSpacing: '0.25em',
          transition: 'border-color 0.2s, color 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(232,220,196,0.4)';
          e.currentTarget.style.color = 'rgba(232,220,196,0.9)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'rgba(232,220,196,0.18)';
          e.currentTarget.style.color = 'rgba(232,220,196,0.55)';
        }}
      >
        {skipLabel} →
      </button>
    </div>
  );
}
