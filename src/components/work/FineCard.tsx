'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Stars } from '@/components/common/Stars';
import { Icon } from '@/lib/icons';
import { formatNum } from '@/lib/format';
import { FREE_MODE } from '@/lib/constants';
import { WorkCover } from '@/components/work/WorkCover';
import { UserAvatar } from '@/components/common/UserAvatar';
import type { WorkListItem } from '@/lib/types';

/** 精品卡（对应原型 .fine-card）— 外层用 Link 获得 Next 路由预取 */
export function FineCard({ work }: { work: WorkListItem }) {
  const router = useRouter();
  return (
    <Link className="fine-card" href={`/work/${work.id}`}>
      <WorkCover
        work={work}
        containerClassName="fine-cover"
        badges={
          <>
            <span className="badge-fine" style={{ position: 'absolute', top: 9, left: 9 }}>
              💎 精品
            </span>
            {work.quality === 'SELECTED' ? (
              <span className="qb" style={{ position: 'absolute', top: 9, right: 9 }}>
                🏅 精选
              </span>
            ) : null}
          </>
        }
      />
      <div className="fine-body">
        <h4>{work.title}</h4>
        <div className="desc">{work.description}</div>
        <div className="fine-author">
          <UserAvatar id={work.author.id} user={work.author} size={22} radius={6} />
          <span
            style={{ fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push(`/user/${work.author.id}`);
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
            {FREE_MODE || work.isFree ? (
              '免费'
            ) : (
              <>
                ¥{work.price}
                {work.oldPrice ? <small>¥{work.oldPrice}</small> : null}
              </>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
