'use client';

import { useRouter } from 'next/navigation';
import { Stars } from '@/components/common/Stars';
import { Icon } from '@/lib/icons';
import { formatNum } from '@/lib/format';
import type { WorkListItem } from '@/lib/types';

/** 精品卡（对应原型 .fine-card） */
export function FineCard({ work }: { work: WorkListItem }) {
  const router = useRouter();
  return (
    <div className="fine-card" onClick={() => router.push(`/work/${work.id}`)}>
      <div className={`fine-cover ${work.coverTheme}`}>
        <div className="glyph">{work.coverIcon}</div>
        <div className="watermark">{work.course}</div>
        <span className="badge-fine" style={{ position: 'absolute', top: 9, left: 9 }}>
          💎 精品
        </span>
        {work.quality === 'SELECTED' ? (
          <span className="qb" style={{ position: 'absolute', top: 9, right: 9 }}>
            🏅 精选
          </span>
        ) : null}
      </div>
      <div className="fine-body">
        <h4>{work.title}</h4>
        <div className="desc">{work.description}</div>
        <div className="fine-author">
          <div
            className="wa-av"
            style={{ background: work.author.avatarColor, width: 22, height: 22, fontSize: 10 }}
          >
            {work.author.username[0]}
          </div>
          <span
            style={{ fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/creator/${work.author.id}`);
            }}
          >
            {work.author.username}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-soft)' }}>
            已帮助 {formatNum(work.downloads)} 位同学
          </span>
        </div>
        <div className="fine-foot">
          <span className="fine-stats">
            <span>
              <Icon name="fav" width={12} />
              {work.favs}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Stars value={Number(work.rating)} size="sm" />
              <b style={{ fontWeight: 600, color: 'var(--ink)' }}>{work.rating}</b>
            </span>
          </span>
          <span className="fine-price">
            ¥{work.price}
            {work.oldPrice ? <small>¥{work.oldPrice}</small> : null}
          </span>
        </div>
      </div>
    </div>
  );
}
