'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { toast } from '@/stores/ui';
import { useAuth } from '@/hooks/useAuth';
import { Empty } from '@/components/common/Empty';

type PendingWork = { id: string; title: string; course: string; author: { username: string } };
type Report = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  reporter: string;
  createdAt: string;
};

export default function AdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'works' | 'reports'>('works');
  const { user, isLoading: authLoading } = useAuth();

  const pending = useQuery({
    queryKey: ['admin', 'works', 'pending'],
    queryFn: () => apiFetch<PendingWork[]>('/admin/works/pending'),
    enabled: user?.role === 'ADMIN',
  });
  const reports = useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: () => apiFetch<Report[]>('/admin/reports'),
    enabled: user?.role === 'ADMIN',
  });

  const audit = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      apiFetch(`/admin/works/${id}/audit`, { method: 'POST', body: JSON.stringify({ action }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'works', 'pending'] });
      toast('已处理', 'ok');
    },
  });

  const handleReport = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/admin/reports/${id}`, { method: 'POST', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
      toast('已处理', 'ok');
    },
  });

  if (authLoading) return <main className="page">加载中…</main>;
  if (!user) {
    return (
      <main className="page">
        <Empty
          icon="🔒"
          title="请先登录"
          desc="管理后台需要登录后才能访问"
          action={
            <Link className="btn btn-primary" href="/login?from=/admin">
              去登录
            </Link>
          }
        />
      </main>
    );
  }
  if (user.role !== 'ADMIN') {
    return (
      <main className="page">
        <Empty
          icon="🚫"
          title="需要管理员权限"
          desc={`当前账号「${user.username}」不是管理员，无法访问管理后台`}
          action={
            <Link className="btn btn-primary" href="/">
              返回首页
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>管理后台</h1>
          <div className="sub">作品审核 / 举报处置 / 提现审批</div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 18 }}>
        <button
          className={`tab-btn ${tab === 'works' ? 'active' : ''}`}
          onClick={() => setTab('works')}
        >
          待审核作品
        </button>
        <button
          className={`tab-btn ${tab === 'reports' ? 'active' : ''}`}
          onClick={() => setTab('reports')}
        >
          举报队列
        </button>
      </div>

      {tab === 'works' ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>作品</th>
                <th>课程</th>
                <th>作者</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pending.data?.length ? (
                pending.data.map((w) => (
                  <tr key={w.id}>
                    <td>{w.title}</td>
                    <td>{w.course}</td>
                    <td>{w.author.username}</td>
                    <td>
                      <button
                        className="btn btn-mint btn-sm"
                        style={{ marginRight: 6 }}
                        onClick={() => audit.mutate({ id: w.id, action: 'APPROVE' })}
                      >
                        通过
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => audit.mutate({ id: w.id, action: 'REJECT' })}
                      >
                        驳回
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}
                  >
                    暂无待审核作品
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>类型</th>
                <th>对象</th>
                <th>原因</th>
                <th>举报人</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {reports.data?.length ? (
                reports.data.map((r) => (
                  <tr key={r.id}>
                    <td>{r.targetType}</td>
                    <td>{r.targetId}</td>
                    <td>{r.reason}</td>
                    <td>{r.reporter}</td>
                    <td>{r.status}</td>
                    <td>
                      {r.status === 'OPEN' ? (
                        <button
                          className="btn btn-mint btn-sm"
                          onClick={() => handleReport.mutate({ id: r.id, status: 'RESOLVED' })}
                        >
                          已处理
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>已处置</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}
                  >
                    暂无举报
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
