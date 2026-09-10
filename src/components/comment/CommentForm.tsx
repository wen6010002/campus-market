'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/stores/ui';
import { ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { useCreateComment, type CommentTargetType } from '@/hooks/useComments';

interface Props {
  targetType: CommentTargetType;
  targetId: string;
  /** 回复对象（null = 发一级评论） */
  replyTo?: { id: string; username: string } | null;
  onCancelReply?: () => void;
  /** 提交成功后回调（列表 invalidate 之外还要做的事，如滚动） */
  onPosted?: () => void;
  autoFocus?: boolean;
}

/** 评论输入框（V12）：登录可发；结果分派——VISIBLE 乐观提示 / PENDING 审核中 /
 *  COMMENT_REJECTED 违规提示。600 字上限与后端一致。 */
export function CommentForm({
  targetType,
  targetId,
  replyTo = null,
  onCancelReply,
  onPosted,
  autoFocus,
}: Props) {
  const { user, isLoading: authLoading } = useAuth();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const create = useCreateComment(targetType, targetId);
  const taRef = useRef<HTMLTextAreaElement>(null);

  if (authLoading) return <div className="cm-form cm-loading">…</div>;

  if (!user) {
    return (
      <div className="cm-form cm-login-row">
        <span>登录后就可以评论了</span>
        <a
          className="btn btn-primary btn-sm"
          href={`/login?next=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`}
        >
          去登录
        </a>
      </div>
    );
  }

  async function submit() {
    const text = content.trim();
    if (!text) return toast('先写点内容吧', 'warn');
    if (text.length > 600) return toast('评论最多 600 字', 'warn');
    setSubmitting(true);
    try {
      const r = await create.mutateAsync({ content: text, parentId: replyTo?.id });
      setContent('');
      if (r.status === 'PENDING_REVIEW') {
        toast('已提交，审核通过后会展示', 'ok');
      } else {
        toast('评论已发布', 'ok');
      }
      onCancelReply?.();
      onPosted?.();
    } catch (e) {
      // COMMENT_REJECTED / RATE_LIMITED / CONFLICT 等服务端语义文案
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '发布失败，请稍后再试', 'warn');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`cm-form ${replyTo ? 'cm-form-reply' : ''}`}>
      {replyTo ? (
        <div className="cm-replying">
          回复 <b>@{replyTo.username}</b>
          <button type="button" onClick={onCancelReply}>
            ✕
          </button>
        </div>
      ) : null}
      <textarea
        ref={taRef}
        value={content}
        autoFocus={autoFocus}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl/Cmd+Enter 快捷发送
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
        }}
        placeholder={
          replyTo ? `回复 @${replyTo.username}…` : '友善交流，提问分享都可以（Ctrl+Enter 发送）'
        }
        maxLength={600}
        rows={replyTo ? 2 : 3}
      />
      <div className="cm-form-foot">
        <span className={`cm-count ${content.length > 550 ? 'near' : ''}`}>
          {content.length}/600
        </span>
        <button
          className="btn btn-primary btn-sm"
          disabled={submitting || !content.trim()}
          onClick={submit}
        >
          {submitting ? '发布中…' : replyTo ? '回复' : '发布评论'}
        </button>
      </div>
    </div>
  );
}
