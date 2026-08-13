'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '@/lib/icons';
import { QualityBadge } from '@/lib/constants';
import { formatNum } from '@/lib/format';
import type { WorkListItem } from '@/lib/types';

interface Props {
  work: WorkListItem;
}

/** 作品卡（对应原型 .work-card） */
export function WorkCard({ work }: Props) {
  const router = useRouter();
  const h = 150 + (Math.abs(work.title.length * 7) % 50);
  const qb = work.quality === 'SELECTED' ? '🏅 精选' : work.quality === 'HIGH' ? '⭐ 高评' : '';

  return (
    <div className="work-card" onClick={() => router.push(`/work/${work.id}`)}>
      <div className={`work-cover ${work.coverTheme}`} style={{ height: h }}>
        <div className="work-badges">
          {work.isFree ? (
            <span className="badge-free">免费</span>
          ) : (
            <span className="badge-fine">💎 精品</span>
          )}
          {qb ? <span className="qb">{qb}</span> : null}
        </div>
        <div className="glyph">{work.coverIcon}</div>
        <div className="watermark">{work.course}</div>
        <div className="work-overlay">
          <button className="ov-btn primary">查看作品</button>
        </div>
      </div>
      <div className="work-body">
        <h4>{work.title}</h4>
        <div className="work-desc">{work.description}</div>
        <div className="work-tags">
          {work.tags.slice(0, 3).map((t, i) => (
            <span key={t} className={`t ${i > 1 ? 'gray' : ''}`}>
              {t}
            </span>
          ))}
        </div>
        <div className="work-stats">
          <span>
            <Icon name="like" width={13} />
            {work.likes}
          </span>
          <span>
            <Icon name="fav" width={13} />
            {work.favs}
          </span>
          <span>
            <Icon name="eye" width={13} />
            {formatNum(work.views)}
          </span>
        </div>
        <div className="work-foot">
          <div
            className="work-author"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/creator/${work.author.id}`);
            }}
          >
            <div className="wa-av" style={{ background: work.author.avatarColor }}>
              {work.author.username[0] ?? '?'}
            </div>
            <span className="wa-name">{work.author.username}</span>
          </div>
          {work.isFree ? (
            <span className="work-price free">免费</span>
          ) : (
            <span className="work-price fine">
              ¥{work.price}
              {work.oldPrice ? <small>¥{work.oldPrice}</small> : null}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
