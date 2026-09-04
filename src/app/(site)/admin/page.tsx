'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { toast } from '@/stores/ui';
import { useAuth } from '@/hooks/useAuth';
import { Empty } from '@/components/common/Empty';

type PendingWork = { id: string; title: string; course: string; author: { username: string } };
type ReportGroup = {
  targetType: string;
  targetId: string;
  targetTitle: string | null;
  snapshot: {
    title?: string;
    desc?: string;
    content?: string;
    stars?: number;
    username?: string;
    workTitle?: string;
    authorName?: string;
    workStatus?: string;
  } | null;
  count: number;
  reporters: { username: string; reason: string; detail: string | null; at: string }[];
  reasons: { reason: string; n: number }[];
  latestAt: string;
  openCount: number;
  status: string;
};
type PayoutItem = {
  id: string;
  amount: string;
  method: string;
  creator: string;
  requestedAt: string;
};
type PendingCreator = {
  id: string;
  userId: string;
  username: string;
  email: string;
  bio: string;
  direction: string;
  appliedAt: string | null;
};
type AdminUser = {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};
type PendingRoadmap = {
  id: string;
  title: string;
  summary: string;
  coverIcon: string;
  category: string;
  stepsCount: number;
  uploader: { id: string; username: string };
  experience: string | null;
  hasCredential: boolean;
  createdAt: string;
};
type ReviewRoadmap = PendingRoadmap & {
  content: { phases: { title: string; desc: string; steps: { id: string; text: string; note?: string }[] }[] };
  experience: string | null;
  credentialUrl: string | null;
  mdUrl: string;
  works: { id: string; title: string }[];
};
type Stats = {
  users: number;
  works: number;
  orders: number;
  revenue: string;
  pendingWorks: number;
  pendingPayouts: number;
};

const TABS = [
  { key: 'works', label: '资料审核' },
  { key: 'roadmaps', label: '路线图审核' },
  { key: 'announcements', label: '公告管理' },
  { key: 'reports', label: '举报队列' },
  { key: 'payouts', label: '提现审批' },
  { key: 'creators', label: '创作者认证' },
  { key: 'users', label: '用户管理' },
];

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="page">加载中…</main>}>
      <AdminContent />
    </Suspense>
  );
}

function AdminContent() {
  const qc = useQueryClient();
  const sp = useSearchParams();
  const [tab, setTab] = useState(() => {
    const t = sp.get('tab') ?? 'works';
    return TABS.some((x) => x.key === t) ? t : 'works';
  });
  // URL ?tab= 变化时同步（/ops 概览卡深链跳转）
  useEffect(() => {
    const t = sp.get('tab');
    if (t && TABS.some((x) => x.key === t)) setTab(t);
  }, [sp]);
  const { user, isLoading: authLoading } = useAuth();

  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => apiFetch<Stats>('/admin/stats'),
    enabled: user?.role === 'ADMIN',
  });
  const pending = useQuery({
    queryKey: ['admin', 'works', 'pending'],
    queryFn: () => apiFetch<PendingWork[]>('/admin/works/pending'),
    enabled: user?.role === 'ADMIN',
  });
  const reports = useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: () => apiFetch<{ data: ReportGroup[]; total: number }>('/admin/reports'),
    enabled: user?.role === 'ADMIN',
  });
  const [reportFilter, setReportFilter] = useState('');
  const [handling, setHandling] = useState<ReportGroup | null>(null);
  const [handleForm, setHandleForm] = useState({
    action: 'RESOLVE' as 'RESOLVE' | 'DISMISS',
    note: '',
    takedownWork: false,
    deleteComment: false,
    banUser: false,
    banReason: '',
  });
  const payouts = useQuery({
    queryKey: ['admin', 'payouts'],
    queryFn: () => apiFetch<PayoutItem[]>('/admin/payouts'),
    enabled: user?.role === 'ADMIN',
  });
  const creators = useQuery({
    queryKey: ['admin', 'creators', 'pending'],
    queryFn: () => apiFetch<PendingCreator[]>('/admin/creators/pending'),
    enabled: user?.role === 'ADMIN',
  });
  const users = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiFetch<AdminUser[]>('/admin/users'),
    enabled: user?.role === 'ADMIN',
  });

  // ===== 路线图审核（V4） =====
  const roadmapPending = useQuery({
    queryKey: ['admin', 'roadmaps', 'pending'],
    queryFn: () => apiFetch<PendingRoadmap[]>('/admin/roadmaps/pending'),
    enabled: user?.role === 'ADMIN',
  });
  const [reviewing, setReviewing] = useState<ReviewRoadmap | null>(null);
  const auditRoadmap = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: string; note?: string }) =>
      apiFetch(`/admin/roadmaps/${id}/audit`, {
        method: 'POST',
        body: JSON.stringify({ action, note }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      setReviewing(null);
      toast('已处理，结果已通知上传者', 'ok');
    },
  });

  const openRoadmapReview = async (id: string) => {
    try {
      const detail = await apiFetch<ReviewRoadmap>(`/admin/roadmaps/${id}`);
      setReviewing(detail);
    } catch (e) {
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '加载审核详情失败', 'warn');
    }
  };

  const audit = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      apiFetch(`/admin/works/${id}/audit`, { method: 'POST', body: JSON.stringify({ action }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast('已处理', 'ok');
    },
  });
  const handleReport = useMutation({
    mutationFn: (input: {
      targetType: string;
      targetId: string;
      action: 'RESOLVE' | 'DISMISS';
      note?: string;
      measures?: object;
    }) => apiFetch('/admin/reports/handle', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast('处置完成，已通知举报人', 'ok');
      setHandling(null);
      setHandleForm({
        action: 'RESOLVE',
        note: '',
        takedownWork: false,
        deleteComment: false,
        banUser: false,
        banReason: '',
      });
    },
  });
  const auditPayout = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'complete' | 'reject' }) =>
      apiFetch(`/admin/payouts/${id}`, { method: 'POST', body: JSON.stringify({ action }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast('已处理', 'ok');
    },
  });
  const auditCreator = useMutation({
    mutationFn: ({ userId, approve }: { userId: string; approve: boolean }) =>
      apiFetch(`/admin/creators/${userId}/audit`, {
        method: 'POST',
        body: JSON.stringify({ approve }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast('已处理', 'ok');
    },
  });
  const banUser = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiFetch(`/admin/users/${id}/ban`, { method: 'POST', body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast('已封禁', 'ok');
    },
  });
  const unbanUser = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/users/${id}/unban`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast('已解封', 'ok');
    },
  });
  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiFetch(`/admin/users/${id}/role`, { method: 'POST', body: JSON.stringify({ role }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast('已改角色', 'ok');
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
          <div className="sub">作品审核 / 举报 / 提现 / 创作者认证 / 用户管理</div>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat-card">
          <div className="lb">用户数</div>
          <div className="v">{stats.data?.users ?? '-'}</div>
        </div>
        <div className="stat-card">
          <div className="lb">已上架作品</div>
          <div className="v">{stats.data?.works ?? '-'}</div>
        </div>
        <div className="stat-card">
          <div className="lb">已支付订单</div>
          <div className="v">{stats.data?.orders ?? '-'}</div>
        </div>
        <div className="stat-card">
          <div className="lb">累计交易额</div>
          <div className="v">¥{stats.data?.revenue ?? '-'}</div>
        </div>
        <div className="stat-card">
          <div className="lb">待审核作品</div>
          <div className="v">{stats.data?.pendingWorks ?? '-'}</div>
        </div>
        <div className="stat-card">
          <div className="lb">待审批提现</div>
          <div className="v">{stats.data?.pendingPayouts ?? '-'}</div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 18 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'works' && (
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
                    <td>
                      <Link
                        className="link"
                        href={`/work/${w.id}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--pri-600)', fontWeight: 600 }}
                      >
                        {w.title}
                      </Link>
                    </td>
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
      )}

      {tab === 'roadmaps' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>路线图</th>
                <th>上传者</th>
                <th>步骤</th>
                <th>审核材料</th>
                <th>提交时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {roadmapPending.isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>
                    加载中…
                  </td>
                </tr>
              ) : roadmapPending.data?.length ? (
                roadmapPending.data.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.coverIcon} {r.title}</b>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{r.summary}</div>
                    </td>
                    <td>{r.uploader.username}</td>
                    <td>{r.stepsCount} 步</td>
                    <td>{r.hasCredential ? '🪪 学生证' : '—'}</td>
                    <td style={{ color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                      {new Date(r.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-light btn-sm"
                        style={{ marginRight: 6 }}
                        onClick={() => openRoadmapReview(r.id)}
                      >
                        审核
                      </button>
                      <button
                        className="btn btn-mint btn-sm"
                        style={{ marginRight: 6 }}
                        onClick={() => auditRoadmap.mutate({ id: r.id, action: 'APPROVE' })}
                      >
                        通过
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          const note = window.prompt('驳回原因（将通知上传者）') ?? undefined;
                          if (note !== undefined) auditRoadmap.mutate({ id: r.id, action: 'REJECT', note });
                        }}
                      >
                        驳回
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>
                    暂无待审核路线图
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'announcements' && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ marginBottom: 8 }}>公告管理</h3>
          <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 16 }}>
            发布后所有用户下次进入站点时弹窗提醒（每条公告每用户只弹一次），公告列表常年可通过顶栏「公告」按钮查看。
          </p>
          <Link className="btn btn-primary" href="/announcements">
            前往公告中心发布 / 撤回 →
          </Link>
        </div>
      )}

      {tab === 'reports' && (
        <div>
          <div className="tabs" style={{ marginBottom: 14 }}>
            {[
              { key: '', label: '全部' },
              { key: 'OPEN', label: '待处理' },
              { key: 'RESOLVED', label: '已处置' },
              { key: 'DISMISSED', label: '已驳回' },
            ].map((f) => (
              <button
                key={f.key}
                className={`tab-btn ${reportFilter === f.key ? 'active' : ''}`}
                onClick={() => setReportFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {(reports.data?.data ?? [])
            .filter((g) => !reportFilter || g.status === reportFilter)
            .map((g) => (
              <div key={g.targetType + g.targetId} className="card rp-group">
                <div className="rp-head">
                  <span className={`up-status ${g.status}`}>
                    {g.status === 'OPEN'
                      ? '待处理'
                      : g.status === 'DISMISSED'
                        ? '已驳回'
                        : '已处置'}
                  </span>
                  <span className="chip gray">
                    {g.targetType === 'WORK'
                      ? '作品'
                      : g.targetType === 'USER'
                        ? '用户'
                        : g.targetType === 'RATING'
                          ? '评价'
                          : '评论'}
                  </span>
                  <b className="rp-title">{g.targetTitle ?? g.targetId}</b>
                  <span className="rp-count">🔥 {g.count} 人举报</span>
                  {g.openCount > 0 ? (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ marginLeft: 'auto' }}
                      onClick={() => setHandling(g)}
                    >
                      处置
                    </button>
                  ) : null}
                </div>
                {g.snapshot ? (
                  <div className="rp-snap">
                    {g.snapshot.desc ? <div>简介：{g.snapshot.desc}</div> : null}
                    {g.snapshot.content ? <div>内容：{g.snapshot.content}</div> : null}
                    {g.snapshot.workTitle ? <div>所属作品：{g.snapshot.workTitle}</div> : null}
                    {g.snapshot.authorName ? <div>作者：{g.snapshot.authorName}</div> : null}
                  </div>
                ) : null}
                <div className="chips" style={{ marginBottom: 8 }}>
                  {g.reasons.map((r) => (
                    <span key={r.reason} className="chip tag">
                      {r.reason} ×{r.n}
                    </span>
                  ))}
                </div>
                <div className="rp-reporters">
                  举报人：
                  {g.reporters.map((r) => (
                    <span key={r.username + r.at} className="chip gray">
                      {r.username}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          {!reports.data?.data?.length ? (
            <Empty icon="🛡️" title="暂无举报" desc="社区安静如常" />
          ) : null}
        </div>
      )}

      {tab === 'payouts' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>金额</th>
                <th>方式</th>
                <th>创作者</th>
                <th>申请时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {payouts.data?.length ? (
                payouts.data.map((p) => (
                  <tr key={p.id}>
                    <td>¥{p.amount}</td>
                    <td>{p.method}</td>
                    <td>{p.creator}</td>
                    <td>{p.requestedAt}</td>
                    <td>
                      <button
                        className="btn btn-mint btn-sm"
                        style={{ marginRight: 6 }}
                        onClick={() => auditPayout.mutate({ id: p.id, action: 'complete' })}
                      >
                        到账
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => auditPayout.mutate({ id: p.id, action: 'reject' })}
                      >
                        拒绝
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}
                  >
                    暂无提现申请
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'creators' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>用户名</th>
                <th>邮箱</th>
                <th>方向</th>
                <th>简介</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {creators.data?.length ? (
                creators.data.map((c) => (
                  <tr key={c.id}>
                    <td>{c.username}</td>
                    <td>{c.email}</td>
                    <td>{c.direction}</td>
                    <td
                      style={{
                        maxWidth: 240,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.bio}
                    </td>
                    <td>
                      <button
                        className="btn btn-mint btn-sm"
                        style={{ marginRight: 6 }}
                        onClick={() => auditCreator.mutate({ userId: c.userId, approve: true })}
                      >
                        通过
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => auditCreator.mutate({ userId: c.userId, approve: false })}
                      >
                        驳回
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}
                  >
                    暂无待认证申请
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'users' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>用户名</th>
                <th>邮箱</th>
                <th>角色</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.data?.length ? (
                users.data.map((u) => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>
                      {u.status === 'BANNED' ? '已封禁' : u.status === 'ACTIVE' ? '正常' : u.status}
                    </td>
                    <td>
                      {u.role !== 'ADMIN' && u.status !== 'BANNED' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ marginRight: 6 }}
                          onClick={() => {
                            const reason = window.prompt('封号原因（选填）');
                            banUser.mutate({ id: u.id, reason: reason ?? undefined });
                          }}
                        >
                          封号
                        </button>
                      )}
                      {u.status === 'BANNED' && (
                        <button
                          className="btn btn-mint btn-sm"
                          style={{ marginRight: 6 }}
                          onClick={() => unbanUser.mutate(u.id)}
                        >
                          解封
                        </button>
                      )}
                      {u.role !== 'ADMIN' && (
                        <select
                          className="input"
                          style={{ width: 100, display: 'inline-block' }}
                          value={u.role}
                          onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value })}
                        >
                          <option value="STUDENT">STUDENT</option>
                          <option value="CREATOR">CREATOR</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}
                  >
                    暂无用户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {handling ? (
        <div className="modal-overlay" onClick={() => setHandling(null)}>
          <div
            className="modal modal-md"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 520 }}
          >
            <div className="modal-head">
              <b>处置举报</b>
              <button className="modal-x" onClick={() => setHandling(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
                {handling.targetTitle} · {handling.count} 人举报
              </div>
              <div className="field">
                <label>处理结果</label>
                <div className="opt-list">
                  <div
                    className={`opt ${handleForm.action === 'RESOLVE' ? 'active' : ''}`}
                    onClick={() => setHandleForm((h) => ({ ...h, action: 'RESOLVE' }))}
                  >
                    <span className="opt-radio" />
                    <div className="opt-main">
                      <b>举报属实，执行处置</b>
                      <span>关闭全部举报单并按需处置内容</span>
                    </div>
                  </div>
                  <div
                    className={`opt ${handleForm.action === 'DISMISS' ? 'active' : ''}`}
                    onClick={() => setHandleForm((h) => ({ ...h, action: 'DISMISS' }))}
                  >
                    <span className="opt-radio" />
                    <div className="opt-main">
                      <b>不属实，驳回</b>
                      <span>关闭全部举报单并通知举报人</span>
                    </div>
                  </div>
                </div>
              </div>
              {handleForm.action === 'RESOLVE' ? (
                <div className="field">
                  <label>处置措施（可多选）</label>
                  <label
                    className="check"
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      marginBottom: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={handleForm.takedownWork}
                      disabled={handling.targetType !== 'WORK'}
                      onChange={(e) =>
                        setHandleForm((h) => ({ ...h, takedownWork: e.target.checked }))
                      }
                    />
                    <span>
                      下架该作品{handling.targetType !== 'WORK' ? '（仅作品类举报可选）' : ''}
                    </span>
                  </label>
                  <label
                    className="check"
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      marginBottom: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={handleForm.deleteComment}
                      disabled={
                        handling.targetType !== 'RATING' && handling.targetType !== 'COMMENT'
                      }
                      onChange={(e) =>
                        setHandleForm((h) => ({ ...h, deleteComment: e.target.checked }))
                      }
                    />
                    <span>删除该{handling.targetType === 'RATING' ? '评价' : '评论'}</span>
                  </label>
                  <label
                    className="check"
                    style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={handleForm.banUser}
                      onChange={(e) => setHandleForm((h) => ({ ...h, banUser: e.target.checked }))}
                    />
                    <span>封禁内容作者</span>
                  </label>
                  {handleForm.banUser ? (
                    <input
                      className="input"
                      style={{ marginTop: 8 }}
                      placeholder="封禁原因（必填）"
                      value={handleForm.banReason}
                      onChange={(e) => setHandleForm((h) => ({ ...h, banReason: e.target.value }))}
                    />
                  ) : null}
                </div>
              ) : null}
              <div className="field">
                <label>处理备注{handleForm.action === 'DISMISS' ? '（驳回时必填）' : ''}</label>
                <textarea
                  className="textarea"
                  rows={2}
                  maxLength={600}
                  value={handleForm.note}
                  onChange={(e) => setHandleForm((h) => ({ ...h, note: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setHandling(null)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                disabled={
                  handleReport.isPending ||
                  (handleForm.action === 'DISMISS' && !handleForm.note.trim()) ||
                  (handleForm.banUser && !handleForm.banReason.trim())
                }
                onClick={() =>
                  handleReport.mutate({
                    targetType: handling.targetType,
                    targetId: handling.targetId,
                    action: handleForm.action,
                    note: handleForm.note.trim() || undefined,
                    measures:
                      handleForm.action === 'RESOLVE'
                        ? {
                            takedownWork: handleForm.takedownWork && handling.targetType === 'WORK',
                            deleteComment:
                              handleForm.deleteComment &&
                              (handling.targetType === 'RATING' ||
                                handling.targetType === 'COMMENT'),
                            banUser: handleForm.banUser,
                            banReason: handleForm.banReason.trim() || undefined,
                          }
                        : undefined,
                  })
                }
              >
                {handleReport.isPending ? '处理中…' : '确认处置'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reviewing ? (
        <div className="modal-mask show" onClick={(e) => e.target === e.currentTarget && setReviewing(null)}>
          <div className="modal modal-md" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-head">
              <b>
                审核路线图：{reviewing.coverIcon} {reviewing.title}
              </b>
              <button className="modal-x" onClick={() => setReviewing(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="rm-review-meta">
                <span>上传者：{reviewing.uploader.username}</span>
                <span>{reviewing.stepsCount} 步</span>
                <a href={reviewing.mdUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--pri-600)' }}>
                  下载原始 md ↗
                </a>
              </div>
              {reviewing.experience ? (
                <p className="rm-review-exp">
                  <b>个人经历：</b>
                  {reviewing.experience}
                </p>
              ) : null}
              {reviewing.credentialUrl ? (
                <p style={{ marginBottom: 12 }}>
                  <b style={{ display: 'block', marginBottom: 6 }}>🪪 学生证（点击查看大图）：</b>
                  <a href={reviewing.credentialUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={reviewing.credentialUrl}
                      alt="学生证"
                      style={{ maxHeight: 160, borderRadius: 8, border: '1px solid var(--line)' }}
                    />
                  </a>
                </p>
              ) : null}
              <div className="rm-review-preview">
                {reviewing.content.phases.map((p, i) => (
                  <div key={i} className="rm-phase-mini">
                    <b>
                      {i + 1}. {p.title}
                    </b>
                    {p.desc ? <small>{p.desc}</small> : null}
                    <ul>
                      {p.steps.map((s) => (
                        <li key={s.id}>
                          {s.text}
                          {s.note ? <small> —— {s.note}</small> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-foot">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  const note = window.prompt('驳回原因（将通知上传者）') ?? undefined;
                  if (note !== undefined) auditRoadmap.mutate({ id: reviewing.id, action: 'REJECT', note });
                }}
              >
                驳回
              </button>
              <button
                className="btn btn-mint"
                onClick={() => auditRoadmap.mutate({ id: reviewing.id, action: 'APPROVE' })}
              >
                通过并上架
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
