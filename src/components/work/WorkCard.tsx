'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/lib/icons';
import { QualityBadge } from '@/lib/constants';
import { formatNum } from '@/lib/format';
import { WorkCover } from '@/components/work/WorkCover';
import { UserAvatar } from '@/components/common/UserAvatar';
import type { WorkListItem } from '@/lib/types';

interface Props {
  work: WorkListItem;
}

/** 作品卡（对应原型 .work-card）— 外层用 Link 获得 Next 路由预取 */
export function WorkCard({ work }: Props) {
  const router = useRouter();
  const h = 150 + (Math.abs(work.title.length * 7) % 50);
  const qb = work.quality === 'SELECTED' ? '🏅 精选' : work.quality === 'HIGH' ? '⭐ 高评' : '';

  return (
    <Link className="work-card" href={`/work/${work.id}`}>
      <WorkCover
        work={work}
        containerClassName="work-cover"
        style={{ height: h }}
        badges={
          <div className="work-badges">
            {work.isFree ? (
              <span className="badge-free">免费</span>
            ) : (
              <span className="badge-fine">💎 精品</span>
            )}
            {qb ? <span className="qb">{qb}</span> : null}
          </div>
        }
        overlay={
          <div className="work-overlay">
            <span className="ov-btn primary">查看作品</span>
          </div>
        }
      />
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
          {work.isFree ? (
            <span>
              <Icon name="eye" width={13} />
              {formatNum(Number(work.views))}
            </span>
          ) : (
            <span>
              <Icon name="dl" width={13} />
              {formatNum(work.downloads)}
            </span>
          )}
        </div>
        <div className="work-foot">
          <div
            className="work-author"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push(`/user/${work.author.id}`);
            }}
          >
            <UserAvatar id={work.author.id} user={work.author} size={24} radius={6} />
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
    </Link>
  );
}
