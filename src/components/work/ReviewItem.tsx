'use client';

import { useState } from 'react';
import { Stars } from '@/components/common/Stars';
import { ReportModal } from '@/components/form/ReportModal';
import { UserAvatar } from '@/components/common/UserAvatar';
import { BadgeInline } from '@/components/medal/BadgeInline';
import { timeAgo } from '@/lib/format';
import type { Rating } from '@/lib/types';

/** 单条评价（对应原型 .review-item）；V3-6 增加「···」举报入口 */
export function ReviewItem({ rating }: { rating: Rating }) {
  const [reportOpen, setReportOpen] = useState(false);
  return (
    <div className="review-item">
      <div className="review-top">
        <UserAvatar id={rating.user.id} user={rating.user} size={30} radius={8} />
        <div style={{ flex: 1 }}>
          <b style={{ fontSize: 13.5 }}>
            {rating.user.username}
            <BadgeInline badge={rating.user.badge} />
          </b>
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
            {timeAgo(rating.createdAt)}
          </div>
        </div>
        <Stars value={rating.stars} size="sm" />
        {!rating._mine ? (
          <button
            className="btn btn-light btn-sm"
            style={{ color: 'var(--ink-faint)', padding: '2px 8px' }}
            title="举报这条评价"
            onClick={() => setReportOpen(true)}
          >
            ···
          </button>
        ) : null}
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
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="RATING"
        targetId={rating.id}
        targetLabel={`${rating.user.username} 的评价`}
      />
    </div>
  );
}
