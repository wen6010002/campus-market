'use client';

import { Medal } from './Medal';

export interface PinnedBadge {
  key: string;
  title: string;
  rarity: string;
  symbol: string;
  expiresAt: string | null;
}

/** 佩戴栏（个人主页 hero 区，公开）：≤5 枚勋章槽，限时勋章带呼吸点 */
export function PinnedBadges({ badges }: { badges: PinnedBadge[] }) {
  if (!badges.length) return null;
  return (
    <div className="pin-bar" aria-label="佩戴勋章">
      {badges.map((b) => {
        const remain = b.expiresAt ? new Date(b.expiresAt).getTime() - Date.now() : null;
        const days = remain !== null ? Math.max(0, Math.ceil(remain / 86400_000)) : null;
        return (
          <span
            key={b.key}
            className={`pin-slot ${b.expiresAt ? 'is-flair' : ''}`}
            title={b.expiresAt ? `「${b.title}」限时勋章 · 剩余 ${days} 天` : `「${b.title}」`}
          >
            <Medal symbol={b.symbol} rarity={b.rarity} size={40} />
            {b.expiresAt ? <i className="flair-dot" /> : null}
          </span>
        );
      })}
    </div>
  );
}
