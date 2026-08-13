import { Stars } from '@/components/common/Stars';
import { timeAgo } from '@/lib/format';
import type { Rating } from '@/lib/types';

/** 单条评价（对应原型 .review-item） */
export function ReviewItem({ rating }: { rating: Rating }) {
  return (
    <div className="review-item">
      <div className="review-top">
        <div
          className="avatar"
          style={{ background: rating.user.avatarColor, width: 30, height: 30, fontSize: 12 }}
        >
          {rating.user.username[0] ?? '匿'}
        </div>
        <div style={{ flex: 1 }}>
          <b style={{ fontSize: 13.5 }}>{rating.user.username}</b>
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
            {timeAgo(rating.createdAt)}
          </div>
        </div>
        <Stars value={rating.stars} size="sm" />
      </div>
      <div className="review-text">{rating.text}</div>
      {rating.tags?.length ? (
        <div className="review-tags">
          {rating.tags.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
      ) : null}
      <div className="review-foot">
        <span>👍 有帮助 {rating.helpfulCount}</span>
        {rating._mine ? <span style={{ color: 'var(--pri-600)' }}>我的评价</span> : null}
      </div>
      {rating.creatorReply ? (
        <div className="review-reply">
          <b>作者回复：</b>
          {rating.creatorReply}
        </div>
      ) : null}
    </div>
  );
}
