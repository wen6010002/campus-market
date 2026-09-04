'use client';

import { Medal, RARITY } from './Medal';

export interface InlineBadge {
  key: string;
  title: string;
  rarity: string;
  symbol: string;
  description?: string | null;
}

/**
 * 名字旁小徽章（评论区/作品卡/排行榜）：展示成就一枚。
 * hover 弹说明卡：称号 + 稀有度 + 获取条件（让人看懂这是什么成就）。
 */
export function BadgeInline({
  badge,
  size = 22,
}: {
  badge: InlineBadge | null | undefined;
  size?: number;
}) {
  if (!badge) return null;
  const rar =
    (badge.rarity as keyof typeof RARITY) in RARITY
      ? (badge.rarity as keyof typeof RARITY)
      : 'bronze';
  return (
    <span
      className="badge-inline"
      style={{ width: size, height: size, display: 'inline-flex', verticalAlign: -4 }}
    >
      <Medal symbol={badge.symbol} rarity={badge.rarity} size={size} />
      <span className="badge-pop">
        <b style={{ color: RARITY[rar].rim }}>{badge.title}</b>
        <i>{RARITY[rar].label}勋章</i>
        {badge.description ? <small>{badge.description}</small> : null}
      </span>
    </span>
  );
}
