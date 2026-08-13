'use client';

import { useRouter } from 'next/navigation';
import { useFollow } from '@/hooks/useSocial';
import { formatNum } from '@/lib/format';
import type { CreatorSummary } from '@/lib/types';

/** 创作者卡（对应原型 .creator） */
export function CreatorCard({ creator }: { creator: CreatorSummary }) {
  const router = useRouter();
  const follow = useFollow(creator.id);
  const followed = creator.myFollow ?? false;

  return (
    <div className="creator" onClick={() => router.push(`/creator/${creator.id}`)}>
      <div className="cr-av" style={{ background: creator.avatarColor }}>
        {creator.username[0]}
      </div>
      <div className="cr-check">✓</div>
      <div className="cr-name">{creator.username}</div>
      <div className="cr-info">{creator.college}</div>
      {creator.honor ? <div className="cr-honor">{creator.honor}</div> : null}
      <div className="cr-hero">
        <span className="lb">已帮助</span>
        <div className="num">{formatNum(creator.helped)}</div>
      </div>
      <div className="cr-stats">
        <div className="cr-stat">
          <b>{creator.fans >= 1000 ? `${(creator.fans / 1000).toFixed(1)}k` : creator.fans}</b>
          <span>粉丝</span>
        </div>
        <div className="cr-stat">
          <b>{creator.rate}</b>
          <span>好评</span>
        </div>
        <div className="cr-stat">
          <b>{creator.works}</b>
          <span>作品</span>
        </div>
      </div>
      <button
        className={`cr-follow ${followed ? 'followed' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          follow.mutate(!followed);
        }}
      >
        {followed ? '已关注 ✓' : '关注'}
      </button>
    </div>
  );
}
