'use client';

import { useRef, useState } from 'react';
import { Empty } from '@/components/common/Empty';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import { useComments, useDeleteComment, type CommentTargetType } from '@/hooks/useComments';

interface Props {
  targetType: CommentTargetType;
  targetId: string;
  /** 目标标题（举报弹窗文案用） */
  targetLabel: string;
}

/** 评论区（V12）：表单 + 两级列表 + 加载更多。
 *  资料（WORK）与路线图（ROADMAP）共用；先发后审——正常评论即时可见，
 *  含链接/广告类走「审核中」仅自见。 */
export function CommentSection({ targetType, targetId, targetLabel }: Props) {
  const list = useComments(targetType, targetId);
  const del = useDeleteComment(targetType, targetId);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  return (
    <section className="cm-section" id="comments" ref={rootRef} aria-label="评论区">
      <h2 className="wd-sec">
        评 论<span className="cm-total">{list.total > 0 ? `${list.total}` : ''}</span>
      </h2>

      <CommentForm
        targetType={targetType}
        targetId={targetId}
        onPosted={() => {
          // 发布一级评论后滚到评论区顶部看结果
          rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />

      <div className="cm-list">
        {list.isLoading ? (
          <div className="cm-loading">评论加载中…</div>
        ) : list.data.length ? (
          list.data.map((c) => (
            <div key={c.id}>
              <CommentItem
                comment={c}
                targetType={targetType}
                targetLabel={targetLabel}
                onReply={(id, username) => setReplyTo({ id, username })}
                onDelete={del.mutate}
                deleting={del.isPending}
              />
              {c.replies?.length ? (
                <div className="cm-replies">
                  {c.replies.map((r) => (
                    <CommentItem
                      key={r.id}
                      comment={r}
                      isReply
                      targetType={targetType}
                      targetLabel={targetLabel}
                      onDelete={del.mutate}
                      deleting={del.isPending}
                    />
                  ))}
                </div>
              ) : null}
              {replyTo?.id === c.id ? (
                <div className="cm-reply-box">
                  <CommentForm
                    targetType={targetType}
                    targetId={targetId}
                    replyTo={replyTo}
                    onCancelReply={() => setReplyTo(null)}
                    autoFocus
                  />
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <Empty icon="💬" title="还没有评论" desc="来说第一句吧，作者和后来的同学都会看到" />
        )}
      </div>

      {list.hasMore ? (
        <div className="cm-more">
          <button
            className="btn btn-light btn-sm"
            onClick={list.loadMore}
            disabled={list.isFetchingMore}
          >
            {list.isFetchingMore ? '加载中…' : '加载更多评论'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
