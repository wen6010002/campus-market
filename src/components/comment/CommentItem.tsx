'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserAvatar } from '@/components/common/UserAvatar';
import { BadgeInline } from '@/components/medal/BadgeInline';
import { ReportModal } from '@/components/form/ReportModal';
import { timeAgo } from '@/lib/format';
import type { Comment } from '@/lib/types';
import type { CommentTargetType } from '@/hooks/useComments';

interface Props {
  comment: Comment;
  /** 一级评论 = false，回复 = true（缩进展示） */
  isReply?: boolean;
  targetType: CommentTargetType;
  /** 举报弹窗展示用：目标标题 */
  targetLabel: string;
  /** 打开内联回复框（仅一级评论） */
  onReply?: (id: string, username: string) => void;
  onDelete?: (id: string) => void;
  deleting?: boolean;
}

/** 单条评论（V12）：头像+用户名+勋章+时间+内容；操作=回复/删除/举报；
 *  自己的待审行灰标「审核中」仅自见（Twikoo 模式）。 */
export function CommentItem({
  comment,
  isReply = false,
  targetType,
  targetLabel,
  onReply,
  onDelete,
  deleting,
}: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const pending = comment.status === 'PENDING_REVIEW';

  return (
    <div
      className={`cm-item ${isReply ? 'cm-reply' : ''} ${pending ? 'cm-pending' : ''}`}
      id={`comment-${comment.id}`}
    >
      <UserAvatar
        id={comment.user.id}
        user={comment.user}
        size={isReply ? 24 : 30}
        radius={isReply ? 6 : 8}
      />
      <div className="cm-main">
        <div className="cm-head">
          <Link href={`/user/${comment.user.id}`} className="cm-user">
            {comment.user.username}
          </Link>
          {comment.user.badge ? <BadgeInline badge={comment.user.badge} size={16} /> : null}
          <span className="cm-time">{timeAgo(comment.createdAt)}</span>
          {pending ? <span className="cm-tag">审核中</span> : null}
        </div>
        {/* content 经服务端 sanitize 白名单消毒（b/strong/i/em/br），可安全注入 */}
        <div className="cm-content" dangerouslySetInnerHTML={{ __html: comment.content }} />
        <div className="cm-ops">
          {!isReply && onReply ? (
            <button type="button" onClick={() => onReply(comment.id, comment.user.username)}>
              回复
            </button>
          ) : null}
          {comment._mine && onDelete ? (
            <button
              type="button"
              className="cm-danger"
              disabled={deleting}
              onClick={() => {
                if (window.confirm('删除这条评论？')) onDelete(comment.id);
              }}
            >
              {deleting ? '删除中…' : '删除'}
            </button>
          ) : null}
          {!comment._mine ? (
            <button type="button" onClick={() => setReportOpen(true)}>
              举报
            </button>
          ) : null}
        </div>
      </div>
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="COMMENT"
        targetId={comment.id}
        targetLabel={`${comment.user.username} 在${targetLabel}下的评论`}
      />
    </div>
  );
}
