'use client';

import { Medal, RARITY } from './Medal';

/** 名字旁小徽章（评论区等）：佩戴的第一枚，未过期；极小尺寸下略去缎带上沿 */
export function BadgeInline({
  badge,
  size = 22,
}: {
  badge: { key: string; title: string; rarity: string; symbol: string } | null | undefined;
  size?: number;
}) {
  if (!badge) return null;
  return (
    <span
      className="badge-inline"
      title={`「${badge.title}」${RARITY[badge.rarity as keyof typeof RARITY]?.label ?? ''}勋章`}
      style={{ width: size, height: size, display: 'inline-flex', verticalAlign: -4 }}
    >
      <Medal symbol={badge.symbol} rarity={badge.rarity} size={size} />
    </span>
  );
}
