'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/common/Modal';
import { Empty } from '@/components/common/Empty';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, apiFetchPage, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { toast } from '@/stores/ui';
import type { Announcement } from '@/lib/types';

type AdminAnnouncement = {
  id: string;
  title: string;
  content: string;
  level: string;
  author: { id: string; username: string };
  publishedAt: string;
  deletedAt: string | null;
};

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', level: 'NORMAL' });
  // 编辑态：null=发布新公告；否则为正在编辑的管理条目（wasDeleted=撤回中，保存即重新上架）
  const [editing, setEditing] = useState<{ id: string; wasDeleted: boolean } | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  const list = useQuery({
    queryKey: ['announcements', 'page', page],
    queryFn: () => apiFetchPage<Announcement[]>(`/announcements?page=${page}&pageSize=20`),
  });

  const publish = useMutation({
    mutationFn: () =>
      apiFetch('/admin/announcements', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      toast('公告已发布，用户下次进入时将弹窗提醒', 'ok');
      setPublishing(false);
      setForm({ title: '', content: '', level: 'NORMAL' });
    },
    onError: (e) =>
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '发布失败', 'warn'),
  });

  // 编辑（展示中的改内容；撤回中的保存后重新上架）
  const edit = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/announcements/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...form, republish: editing?.wasDeleted }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      toast(editing?.wasDeleted ? '已保存并重新发布' : '公告已更新', 'ok');
      setEditing(null);
      setPublishing(false);
      setForm({ title: '', content: '', level: 'NORMAL' });
    },
    onError: (e) =>
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '保存失败', 'warn'),
  });

  const openEdit = (a: AdminAnnouncement) => {
    setEditing({ id: a.id, wasDeleted: !!a.deletedAt });
    setForm({ title: a.title, content: a.content ?? '', level: a.level });
    setPublishing(true);
  };

  const unpublish = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/announcements/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      toast('已撤回', 'ok');
    },
  });

  // 管理员在公开页顶部看到管理列表（含已撤回）
  const adminList = useQuery({
    queryKey: ['admin', 'announcements'],
    queryFn: () => apiFetchPage<AdminAnnouncement[]>('/admin/announcements?pageSize=50'),
    enabled: isAdmin,
  });

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>平台公告</h1>
          <div className="sub">官方发布的通知与动态</div>
        </div>
        {isAdmin ? (
          <button className="btn btn-primary" onClick={() => setPublishing(true)}>
            发布公告
          </button>
        ) : null}
      </div>

      {list.isLoading ? (
        <div className="card">加载中…</div>
      ) : list.data?.data.length ? (
        list.data.data.map((a) => (
          <article
            key={a.id}
            className={`card ann-card ${a.level === 'IMPORTANT' ? 'important' : ''}`}
          >
            <div className="ann-card-head">
              {a.level === 'IMPORTANT' ? <span className="ann-level-badge">重要</span> : null}
              <h2>{a.title}</h2>
              <span className="ann-card-time">
                {new Date(a.publishedAt).toLocaleString('zh-CN')} · {a.author.username}
              </span>
            </div>
            <div className="ann-card-body" dangerouslySetInnerHTML={{ __html: a.content }} />
          </article>
        ))
      ) : (
        <Empty icon="📭" title="暂无公告" desc="平台发布通知后会在这里展示" />
      )}

      {list.data && list.data.pagination.totalPages > 1 ? (
        <div className="ops-pager">
          <span className="ops-pager-total">共 {list.data.pagination.total} 条</span>
          <button
            className="btn btn-light btn-sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </button>
          <span className="ops-pager-now">
            {page} / {list.data.pagination.totalPages}
          </span>
          <button
            className="btn btn-light btn-sm"
            disabled={page >= list.data.pagination.totalPages}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </button>
        </div>
      ) : null}

      {isAdmin && adminList.data?.data.length ? (
        <section style={{ marginTop: 32 }}>
          <h3 style={{ marginBottom: 10 }}>管理（含已撤回）</h3>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>标题</th>
                  <th>级别</th>
                  <th>发布时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {adminList.data.data.map((a) => (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td>{a.level === 'IMPORTANT' ? '重要' : '普通'}</td>
                    <td style={{ color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                      {new Date(a.publishedAt).toLocaleString('zh-CN')}
                    </td>
                    <td>{a.deletedAt ? '已撤回' : '展示中'}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>
                        {a.deletedAt ? '编辑并重新发布' : '编辑'}
                      </button>{' '}
                      {!a.deletedAt ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => unpublish.mutate(a.id)}
                        >
                          撤回
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <Modal
        open={publishing}
        onClose={() => {
          setPublishing(false);
          setEditing(null);
          setForm({ title: '', content: '', level: 'NORMAL' });
        }}
      >
        <ModalHead
          title={
            editing ? (editing.wasDeleted ? '编辑公告（保存后重新发布）' : '编辑公告') : '发布公告'
          }
          onClose={() => {
            setPublishing(false);
            setEditing(null);
            setForm({ title: '', content: '', level: 'NORMAL' });
          }}
        />
        <ModalBody>
          <input
            className="input"
            placeholder="标题（1-120 字）"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            style={{ marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {[
              { key: 'NORMAL', label: '普通' },
              { key: 'IMPORTANT', label: '重要（弹窗高亮）' },
            ].map((l) => (
              <button
                key={l.key}
                className={`chip ${form.level === l.key ? 'active' : ''}`}
                onClick={() => setForm({ ...form, level: l.key })}
                type="button"
              >
                {l.label}
              </button>
            ))}
          </div>
          <textarea
            className="input"
            rows={8}
            placeholder={'公告正文（支持加粗 **不适用**，换行直接回车；最长 5000 字）'}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
        </ModalBody>
        <ModalFoot>
          <button
            className="btn btn-light"
            onClick={() => {
              setPublishing(false);
              setEditing(null);
              setForm({ title: '', content: '', level: 'NORMAL' });
            }}
          >
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={() => (editing ? edit.mutate(editing.id) : publish.mutate())}
            disabled={
              (editing ? edit.isPending : publish.isPending) ||
              !form.title.trim() ||
              !form.content.trim()
            }
          >
            {(editing ? edit.isPending : publish.isPending)
              ? '保存中…'
              : editing
                ? editing.wasDeleted
                  ? '保存并重新发布'
                  : '保存修改'
                : '发布'}
          </button>
        </ModalFoot>
      </Modal>
    </main>
  );
}
