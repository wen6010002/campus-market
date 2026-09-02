'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OpsGuard, Pager } from '@/components/ops/OpsGuard';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/common/Modal';
import { apiFetch, apiFetchPage, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { toast } from '@/stores/ui';

type AdminUserRow = {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  avatarColor: string;
  avatarKey?: string | null;
  bannedAt?: string | null;
  bannedReason?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  STUDENT: '学生',
  CREATOR: '创作者',
  ADMIN: '管理员',
};

export default function OpsUsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [banning, setBanning] = useState<AdminUserRow | null>(null);
  const [banReason, setBanReason] = useState('');

  const list = useQuery({
    queryKey: ['ops', 'users', { q, role, status, page }],
    queryFn: () =>
      apiFetchPage<AdminUserRow[]>(
        `/admin/users?q=${encodeURIComponent(q)}&role=${role}&status=${status}&page=${page}&pageSize=20`,
      ),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ops', 'users'] });
    qc.invalidateQueries({ queryKey: ['admin', 'ops'] });
  };

  const ban = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiFetch(`/admin/users/${id}/ban`, { method: 'POST', body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      invalidate();
      toast('已封禁，该用户登录态立即失效', 'ok');
      setBanning(null);
      setBanReason('');
    },
    onError: (e) =>
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '操作失败', 'warn'),
  });
  const unban = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/users/${id}/unban`, { method: 'POST' }),
    onSuccess: () => {
      invalidate();
      toast('已解封', 'ok');
    },
    onError: (e) =>
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '操作失败', 'warn'),
  });
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiFetch(`/admin/users/${id}/role`, { method: 'POST', body: JSON.stringify({ role }) }),
    onSuccess: () => {
      invalidate();
      toast('已修改角色', 'ok');
    },
  });

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    list.refetch();
  };

  return (
    <OpsGuard backHref="/ops">
      <main className="page">
        <div className="page-head">
          <div>
            <h1>用户管理</h1>
            <div className="sub">查看用户信息 · 封号/解封 · 角色调整</div>
          </div>
          <Link className="btn btn-light" href="/ops">
            ← 返回控制台
          </Link>
        </div>

        <form className="ops-filter" onSubmit={search}>
          <input
            className="input"
            placeholder="搜索用户名 / 邮箱"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="input" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
            <option value="">全部角色</option>
            <option value="STUDENT">学生</option>
            <option value="CREATOR">创作者</option>
            <option value="ADMIN">管理员</option>
          </select>
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">全部状态</option>
            <option value="ACTIVE">正常</option>
            <option value="BANNED">已封禁</option>
          </select>
          <button className="btn btn-primary" type="submit">
            搜索
          </button>
        </form>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>用户</th>
                <th>邮箱</th>
                <th>角色</th>
                <th>状态</th>
                <th>注册时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>
                    加载中…
                  </td>
                </tr>
              ) : list.data?.data.length ? (
                list.data.data.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UserAvatar
                          id={u.id}
                          user={{ username: u.username, avatarColor: u.avatarColor, hasAvatar: !!u.avatarKey }}
                          size={30}
                          radius={7}
                        />
                        <Link href={`/ops/users/${u.id}`} className="link" style={{ fontWeight: 600 }}>
                          {u.username}
                        </Link>
                      </div>
                    </td>
                    <td style={{ color: 'var(--ink-2)' }}>{u.email}</td>
                    <td>
                      {u.role === 'ADMIN' ? (
                        <span className="chip gray">{ROLE_LABEL[u.role]}</span>
                      ) : (
                        <select
                          className="input"
                          style={{ padding: '4px 8px', fontSize: 13 }}
                          value={u.role}
                          onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value })}
                        >
                          <option value="STUDENT">学生</option>
                          <option value="CREATOR">创作者</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {u.status === 'BANNED' ? (
                        <span className="up-status" title={u.bannedReason ?? undefined}>
                          已封禁
                        </span>
                      ) : (
                        <span className="up-status" style={{ color: 'var(--mint)' }}>
                          正常
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                      {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link className="btn btn-light btn-sm" href={`/ops/users/${u.id}`}>
                        详情
                      </Link>{' '}
                      {u.status === 'BANNED' ? (
                        <button
                          className="btn btn-mint btn-sm"
                          onClick={() => unban.mutate(u.id)}
                          disabled={u.role === 'ADMIN'}
                        >
                          解封
                        </button>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setBanning(u)}
                          disabled={u.role === 'ADMIN'}
                          title={u.role === 'ADMIN' ? '不能封禁管理员' : undefined}
                        >
                          封号
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>
                    没有匹配的用户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {list.data ? (
          <Pager
            page={page}
            totalPages={list.data.pagination.totalPages}
            total={list.data.pagination.total}
            onChange={setPage}
          />
        ) : null}

        <Modal open={!!banning} onClose={() => setBanning(null)}>
          <ModalHead
            title={`封禁用户「${banning?.username}」`}
            onClose={() => setBanning(null)}
          />
          <ModalBody>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: '0 0 10px' }}>
              封禁后该用户立即退出登录，登录时将看到封禁原因；解封后恢复正常。
            </p>
            <textarea
              className="input"
              rows={3}
              maxLength={200}
              placeholder="封禁原因（将展示给该用户，选填）"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          </ModalBody>
          <ModalFoot>
            <button className="btn btn-light" onClick={() => setBanning(null)}>
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={() => banning && ban.mutate({ id: banning.id, reason: banReason || undefined })}
              disabled={ban.isPending}
            >
              {ban.isPending ? '处理中…' : '确认封禁'}
            </button>
          </ModalFoot>
        </Modal>
      </main>
    </OpsGuard>
  );
}
