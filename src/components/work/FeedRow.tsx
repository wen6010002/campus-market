'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CATEGORIES, FREE_MODE } from '@/lib/constants';
import { formatNum } from '@/lib/format';
import { BadgeInline } from '@/components/medal/BadgeInline';
import type { WorkListItem } from '@/lib/types';

/**
 * V10 博客式目录行（替代主页/explore 的 WorkCard/FineCard）。
 * variant:
 *   'feed' — 时间流（最新上架 / 分类浏览）：日期左列
 *   'rec'  — 常青推荐：emoji 方块左列（与时间流用左列形态区分语义）
 * 详情页内嵌小卡仍用 WorkCard/FineCard，不受影响。
 */
export function FeedRow({
  work,
  variant = 'feed',
}: {
  work: WorkListItem;
  variant?: 'feed' | 'rec';
}) {
  const router = useRouter();
  const cat = CATEGORIES.find((c) => c.key === work.category);
  const free = work.isFree || FREE_MODE; // V7 全站免费
  const qb = work.quality === 'SELECTED' ? '🏅 精选' : work.quality === 'HIGH' ? '⭐ 高评' : '';
  const eyebrow = `${cat?.label ?? '资料'}${work.course ? ` · ${work.course}` : ''}`;
  const d = work.publishedAt ?? work.updatedAt;
  const day = new Date(d);
  const dateValid = !Number.isNaN(day.getTime());

  const author = (
    <span
      className="fr-author"
      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/user/${work.author.id}`);
      }}
    >
      <b>{work.author.username}</b>
      <BadgeInline badge={work.author.badge} size={16} />
    </span>
  );

  if (variant === 'rec') {
    return (
      <Link className="rec-row" href={`/work/${work.id}`}>
        <span className="rec-ico">{work.coverIcon}</span>
        <span style={{ minWidth: 0 }}>
          <span className="rec-title">
            {work.title}
            {free ? (
              <span className="fr-pill free">
                {FREE_MODE && !work.isFree ? '限时免费' : '免费'}
              </span>
            ) : (
              <span className="fr-pill fine">💎 精品位</span>
            )}
          </span>
          <div className="rec-sub">
            {eyebrow}
            {qb ? ` · ${qb}` : ''}
          </div>
          <div className="rec-meta">
            {author}
            <span>👁 {formatNum(Number(work.views))}</span>
            <span>⬇ {formatNum(work.downloads)}</span>
          </div>
        </span>
        <span className="rec-arrow">→</span>
      </Link>
    );
  }

  return (
    <Link className="feed-row" href={`/work/${work.id}`}>
      <span className="feed-date">
        {dateValid ? (
          <>
            <b>{String(day.getDate()).padStart(2, '0')}</b>
            <small>{String(day.getMonth() + 1).padStart(2, '0')}月</small>
          </>
        ) : null}
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="feed-eyebrow">
          {eyebrow}
          {free ? (
            <span className="fr-pill free">{FREE_MODE && !work.isFree ? '限时免费' : '免费'}</span>
          ) : (
            <span className="fr-pill fine">💎 精品位</span>
          )}
          {qb ? <span style={{ color: 'var(--warn)' }}>{qb}</span> : null}
        </span>
        <div className="feed-title">{work.title}</div>
        {work.description ? <div className="feed-desc">{work.description}</div> : null}
        <div className="feed-meta">
          {author}
          <span>👁 {formatNum(Number(work.views))}</span>
          <span>❤ {formatNum(work.likes)}</span>
          <span>⬇ {formatNum(work.downloads)}</span>
          {work.tags.slice(0, 2).map((t) => (
            <span key={t} className="tag">
              #{t}
            </span>
          ))}
        </div>
      </span>
      <span className="feed-arrow">→</span>
    </Link>
  );
}
