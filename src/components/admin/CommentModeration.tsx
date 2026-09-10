'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/stores/ui';
import { Empty } from '@/components/common/Empty';
import { timeAgo } from '@/lib/format';

type ModRow = {
  id: string;
  content: string;
  status: 'PENDING_REVIEW' | 'REJECTED' | 'VISIBLE';
  modReason: string | null;
  modSource: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; username: string };
  target: { type: 'WORK' | 'ROADMAP'; id: string; title: string } | null;
};

type WatchUser = {
  id: string;
  username: string;
  email: string;
  status: string;
  rejected7d: number;
};

const SOURCE_LABEL: Record<string, string> = {
  KEYWORD: '词表',
  URL_HOLD: '含链接',
  AI: 'AI',
  AI_FAIL: 'AI 故障',
  QUEUE_FAIL: '队列故障',
  ADMIN: '管理员',
};

/** 评论审核（V12 管理端 tab）：待审/已拒双队列 + 重点观察（7 天被拒≥3） */
export function CommentModeration() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'PENDING_REVIEW' | 'REJECTED'>('PENDING_REVIEW');

  const list = useQuery({
    queryKey: ['admin', 'comments', status],
    queryFn: () =>
      apiFetch<{ data: ModRow[]; watchlist: WatchUser[] }>(
        `/admin/comments?status=${status}&pageSize=30`,
      ),
  });

  const handle = useMutation({
    mutationFn: (input: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      apiFetch(`/admin/comments/${input.id}/handle`, {
        method: 'POST',
        body: JSON.stringify({ action: input.action }),
      }),
    onSuccess: (_d, v) => {
      toast(v.action === 'APPROVE' ? '已放行' : '已拒绝并通知作者', 'ok');
      qc.invalidateQueries({ queryKey: ['admin', 'comments'] });
    },
    onError: () => toast('操作失败，请重试', 'warn'),
  });

  const rows = list.data?.data ?? [];
  const watch = list.data?.watchlist ?? [];

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 14 }}>
        {(
          [
            { key: 'PENDING_REVIEW', label: '待审核' },
            { key: 'REJECTED', label: '已拒绝（日志）' },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            className={`tab-btn ${status === f.key ? 'active' : ''}`}
            onClick={() => setStatus(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {watch.length ? (
        <div className="card" style={{ marginBottom: 14, padding: '12px 16px' }}>
          <b style={{ fontSize: 13.5 }}>⚠️ 重点观察</b>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginLeft: 8 }}>
            近 7 天被拒 ≥3 次，建议核查后到「用户管理」处理
          </span>
          <div className="chips" style={{ marginTop: 8 }}>
            {watch.map((u) => (
              <Link
                key={u.id}
                href={`/user/${u.id}`}
                className="chip gray"
                style={{ textDecoration: 'none' }}
              >
                {u.username} · 拒 {u.rejected7d} 次{u.status === 'BANNED' ? ' · 已封禁' : ''}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {list.isLoading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-soft)' }}>加载中…</div>
      ) : rows.length ? (
        rows.map((c) => (
          <div key={c.id} className="card rp-group">
            <div className="rp-head">
              <span className="chip gray">{c.target?.type === 'ROADMAP' ? '路线图' : '资料'}</span>
              {c.target ? (
                <Link
                  href={`${c.target.type === 'ROADMAP' ? '/roadmaps/' : '/work/'}${c.target.id}#comments`}
                  className="rp-title"
                  style={{ textDecoration: 'none' }}
                >
                  {c.target.title}
                </Link>
              ) : null}
              <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                {c.user.username} · {timeAgo(c.createdAt)}
              </span>
              {c.modSource ? (
                <span className="chip gray" style={{ marginLeft: 'auto' }}>
                  {SOURCE_LABEL[c.modSource] ?? c.modSource}
                </span>
              ) : null}
            </div>
            <div className="rp-snap">
              <div>内容：{c.content}</div>
              {c.modReason ? (
                <div style={{ color: 'var(--pri-600)' }}>原因：{c.modReason}</div>
              ) : null}
            </div>
            {status === 'PENDING_REVIEW' ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  className="btn btn-mint btn-sm"
                  disabled={handle.isPending}
                  onClick={() => handle.mutate({ id: c.id, action: 'APPROVE' })}
                >
                  ✓ 通过并展示
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={handle.isPending}
                  onClick={() => handle.mutate({ id: c.id, action: 'REJECT' })}
                >
                  拒绝（通知作者）
                </button>
              </div>
            ) : null}
          </div>
        ))
      ) : (
        <Empty
          icon="🛡️"
          title={status === 'PENDING_REVIEW' ? '待审队列为空' : '还没有被拒的评论'}
          desc={
            status === 'PENDING_REVIEW'
              ? '正常评论由 AI 自动放行，只有含链接/广告类/拿不准的会到这里'
              : '被词表或 AI 拒绝的评论会留痕在这里'
          }
        />
      )}
    </div>
  );
}
