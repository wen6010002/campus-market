'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OpsGuard } from '@/components/ops/OpsGuard';
import { UserAvatar } from '@/components/common/UserAvatar';
import { apiFetch, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { toast } from '@/stores/ui';

type UserDetail = {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  avatarColor: string;
  avatarKey?: string | null;
  bio?: string | null;
  bannedAt: string | null;
  bannedReason: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  student?: {
    eduEmail: string;
    school: string;
    college: string;
    major: string;
    grade: string;
    verifyStatus: string;
  } | null;
  creator?: {
    id: string;
    bio: string;
    direction: string;
    honor: string | null;
    verified: boolean;
  } | null;
  walletBalance: string | null;
  _count: { works: number; orders: number; favorites: number; reports: number };
};

const ROLE_LABEL: Record<string, string> = {
  STUDENT: '学生',
  CREATOR: '创作者',
  ADMIN: '管理员',
};
const VERIFY_LABEL: Record<string, string> = {
  UNVERIFIED: '未认证',
  PENDING: '审核中',
  VERIFIED: '已认证',
  REJECTED: '未通过',
};

function fmtDate(s: string | null | undefined) {
  return s ? new Date(s).toLocaleString('zh-CN') : '—';
}

export default function OpsUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ['ops', 'user', id],
    queryFn: () => apiFetch<UserDetail>(`/admin/users/${id}`),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ops', 'user', id] });
    qc.invalidateQueries({ queryKey: ['ops', 'users'] });
  };

  const ban = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/users/${id}/ban`, { method: 'POST', body: JSON.stringify({ reason: '违规行为（详见管理后台）' }) }),
    onSuccess: () => {
      invalidate();
      toast('已封禁', 'ok');
    },
    onError: (e) => toast(e instanceof ApiError ? messageFor(e.code, e.message) : '操作失败', 'warn'),
  });
  const unban = useMutation({
    mutationFn: () => apiFetch(`/admin/users/${id}/unban`, { method: 'POST' }),
    onSuccess: () => {
      invalidate();
      toast('已解封', 'ok');
    },
    onError: (e) => toast(e instanceof ApiError ? messageFor(e.code, e.message) : '操作失败', 'warn'),
  });

  return (
    <OpsGuard backHref="/ops/users">
      <main className="page">
        <div className="page-head">
          <div>
            <h1>用户详情</h1>
            <div className="sub">
              <Link href="/ops/users" style={{ color: 'var(--pri)' }}>
                ← 用户管理
              </Link>
            </div>
          </div>
        </div>

        {detail.isLoading ? (
          <div className="card">加载中…</div>
        ) : detail.data ? (
          <>
            <div className="ops-detail-grid">
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <UserAvatar
                    id={detail.data.id}
                    user={{
                      username: detail.data.username,
                      avatarColor: detail.data.avatarColor,
                      hasAvatar: !!detail.data.avatarKey,
                    }}
                    size={56}
                    radius={12}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b style={{ fontSize: 18 }}>{detail.data.username}</b>
                      <span className="chip gray">{ROLE_LABEL[detail.data.role] ?? detail.data.role}</span>
                      {detail.data.status === 'BANNED' ? (
                        <span className="up-status">已封禁</span>
                      ) : (
                        <span className="up-status" style={{ color: 'var(--mint)' }}>
                          正常
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>{detail.data.email}</div>
                  </div>
                </div>
                <table className="kv">
                  <tbody>
                    <tr>
                      <th>注册时间</th>
                      <td>{fmtDate(detail.data.createdAt)}</td>
                    </tr>
                    <tr>
                      <th>最后登录</th>
                      <td>{fmtDate(detail.data.lastLoginAt)}</td>
                    </tr>
                    <tr>
                      <th>个人简介</th>
                      <td>{detail.data.bio || '—'}</td>
                    </tr>
                    {detail.data.student ? (
                      <>
                        <tr>
                          <th>edu 邮箱</th>
                          <td>
                            {detail.data.student.eduEmail}（
                            {VERIFY_LABEL[detail.data.student.verifyStatus] ??
                              detail.data.student.verifyStatus}
                            ）
                          </td>
                        </tr>
                        <tr>
                          <th>学籍</th>
                          <td>
                            {detail.data.student.school} · {detail.data.student.college} ·{' '}
                            {detail.data.student.major} · {detail.data.student.grade}
                          </td>
                        </tr>
                      </>
                    ) : null}
                    {detail.data.creator ? (
                      <tr>
                        <th>创作者</th>
                        <td>
                          {detail.data.creator.direction}
                          {detail.data.creator.verified ? '（已认证）' : '（未认证）'} · 钱包余额 ¥
                          {detail.data.walletBalance ?? '0.00'}
                        </td>
                      </tr>
                    ) : null}
                    {detail.data.status === 'BANNED' ? (
                      <tr>
                        <th>封禁信息</th>
                        <td>
                          {fmtDate(detail.data.bannedAt)} · {detail.data.bannedReason || '未填写原因'}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  {detail.data.status === 'BANNED' ? (
                    <button className="btn btn-mint" onClick={() => unban.mutate()} disabled={unban.isPending}>
                      {unban.isPending ? '解封中…' : '解封账号'}
                    </button>
                  ) : detail.data.role !== 'ADMIN' ? (
                    <button className="btn btn-primary" onClick={() => ban.mutate()} disabled={ban.isPending}>
                      {ban.isPending ? '处理中…' : '封禁账号'}
                    </button>
                  ) : null}
                  <Link className="btn btn-light" href={`/user/${detail.data.id}`} target="_blank">
                    查看公开主页 ↗
                  </Link>
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: 12 }}>业务统计</h3>
                <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="stat-card">
                    <div className="lb">作品数</div>
                    <div className="v">{detail.data._count.works}</div>
                  </div>
                  <div className="stat-card">
                    <div className="lb">购买订单</div>
                    <div className="v">{detail.data._count.orders}</div>
                  </div>
                  <div className="stat-card">
                    <div className="lb">收藏数</div>
                    <div className="v">{detail.data._count.favorites}</div>
                  </div>
                  <div className="stat-card">
                    <div className="lb">提交举报</div>
                    <div className="v">{detail.data._count.reports}</div>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <Link className="btn btn-light btn-sm" href={`/ops/works?authorId=${detail.data.id}`}>
                    管理该用户的作品 →
                  </Link>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="card">未找到该用户</div>
        )}
      </main>
    </OpsGuard>
  );
}
