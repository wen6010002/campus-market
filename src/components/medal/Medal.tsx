'use client';

import { useId } from 'react';
import { MEDAL_SYMBOLS } from './symbols';

/**
 * V8 勋章底座渲染引擎：一套 SVG 底座（缎带+滚花外环+金属渐变环+深内盘+符号）
 * 染六档稀有度。符号为 game-icons 剪影（512 viewBox），缩放居中在内盘。
 * 视觉样稿见 /tmp/medal-sample.html（已验收）。
 */
export type Rarity = 'bronze' | 'silver' | 'gold' | 'plat' | 'diamond' | 'lgd';

export const RARITY: Record<
  Rarity,
  { ring: string[]; rim: string; core: string; core2: string; hi: string; label: string }
> = {
  bronze: {
    ring: ['#5b361c', '#a06a3d', '#e2ab77', '#8a5426', '#c98a5f'],
    rim: '#d9985f',
    core: '#241208',
    core2: '#38200e',
    hi: '#f3c695',
    label: '青铜',
  },
  silver: {
    ring: ['#5c6773', '#aab6c4', '#f4f8fc', '#93a1b1', '#cfd9e4'],
    rim: '#e6edf5',
    core: '#10151d',
    core2: '#20293a',
    hi: '#f4f8fc',
    label: '白银',
  },
  gold: {
    ring: ['#6b4a0e', '#c9982f', '#ffe9a8', '#b8860b', '#e8b93f'],
    rim: '#ffd76e',
    core: '#241a04',
    core2: '#3a2a08',
    hi: '#ffe9a8',
    label: '黄金',
  },
  plat: {
    ring: ['#155e56', '#2fa893', '#d8fff7', '#1e9c82', '#5ed6c6'],
    rim: '#8ff0e0',
    core: '#04211c',
    core2: '#0b3830',
    hi: '#d8fff7',
    label: '铂金',
  },
  diamond: {
    ring: ['#1a4a86', '#5b9fd8', '#d6ecff', '#3d8fe0', '#7db8f0'],
    rim: '#a8d4ff',
    core: '#061524',
    core2: '#0e2a44',
    hi: '#d6ecff',
    label: '钻石',
  },
  lgd: {
    ring: ['#7a2d58', '#c04f92', '#ffb84d', '#8b36b0', '#ff7bb0'],
    rim: '#ff9ecf',
    core: '#1d0716',
    core2: '#331040',
    hi: '#ffd9ec',
    label: '传奇',
  },
};

export function Medal({
  symbol,
  rarity = 'bronze',
  size = 96,
  locked = false,
  className = '',
}: {
  symbol: string;
  rarity?: Rarity | string;
  size?: number;
  locked?: boolean;
  className?: string;
}) {
  const R = RARITY[(rarity as Rarity) in RARITY ? (rarity as Rarity) : 'bronze'];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const g = `mg${uid}`;
  const c = `mc${uid}`;
  const sym = MEDAL_SYMBOLS[symbol] ?? MEDAL_SYMBOLS.trophy;

  return (
    <svg
      className={`medal-svg ${locked ? 'medal-locked' : ''} ${className}`}
      viewBox="0 0 140 156"
      width={size}
      height={(size * 156) / 140}
      style={rarity === 'lgd' && !locked ? { animation: 'medalHue 6s linear infinite' } : undefined}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={R.ring[0]} />
          <stop offset=".22" stopColor={R.ring[1]} />
          <stop offset=".46" stopColor={R.ring[2]} />
          <stop offset=".62" stopColor={R.ring[3]} />
          <stop offset="1" stopColor={R.ring[4]} />
        </linearGradient>
        <radialGradient id={c} cx=".5" cy=".38" r=".8">
          <stop offset="0" stopColor={R.core2} />
          <stop offset="1" stopColor={R.core} />
        </radialGradient>
      </defs>
      {/* 缎带 */}
      <path className="medal-ribbon" d="M56 10 L70 44 L50 52 L38 22 Z" />
      <path className="medal-ribbon lite" d="M84 10 L70 44 L90 52 L102 22 Z" />
      {/* 章体 */}
      <circle cx="70" cy="88" r="46" fill={`url(#${c})`} />
      <circle cx="70" cy="88" r="46" fill="none" stroke={`url(#${g})`} strokeWidth="7" />
      <circle cx="70" cy="88" r="51" fill="none" stroke={R.rim} strokeWidth="1.4" opacity=".8" />
      <circle
        cx="70"
        cy="88"
        r="53.5"
        fill="none"
        stroke={R.rim}
        strokeWidth="2.5"
        strokeDasharray="2.4 3.1"
        opacity=".55"
      />
      <circle cx="70" cy="88" r="40" fill="none" stroke={R.ring[1]} strokeWidth="1" opacity=".5" />
      {/* 中心符号：512 → 内盘（约 56px 视觉尺寸），以章心为基准缩放居中 */}
      <g fill={R.hi} opacity=".96" transform="translate(70 88) scale(.1) translate(-256 -256)">
        <path d={sym} />
      </g>
      {/* 高光 */}
      <ellipse
        cx="54"
        cy="66"
        rx="20"
        ry="10"
        fill="#fff"
        opacity=".07"
        transform="rotate(-24 54 66)"
      />
    </svg>
  );
}
