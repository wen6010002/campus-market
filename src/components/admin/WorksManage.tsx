'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchPage, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { toast } from '@/stores/ui';
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/common/Modal';
import { CATEGORIES, CATEGORY_LABEL } from '@/lib/constants';
import type { CategoryKey } from '@/lib/constants';

type Row = {
  id: string;
  title: string;
  course: string;
  coverIcon: string;
  category: string;
  isFree: boolean;
  price: string;
  status: string;
  downloads: number;
  favs: number;
  views: number;
  createdAt: string;
  author: { id: string; username: string };
};

const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: '已上架',
  PAKEN_DOWN: '已下架',
  TAKEN_DOWN: '已下架',
  PENDING: '待审核',
  DRAFT: '草稿',
  REJECTED: '已驳回',
};

/**
 * 资料管理（ADMIN_CONTENT_MGMT P0）：搜索/筛选/分区调整/批量上线（可选区）/批量删除。
 * V7 免费模式：分区 = isFree（false=自我提升区精品位 / true=校园专区普通流），不展示价格。
 */
export function WorksManage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('PUBLISHED');
  const [category, setCategory] = useState('');
  const [fine, setFine] = useState('');
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<string>>(new Set());
  // 批量上线弹窗：选放哪个区
  const [zonePicking, setZonePicking] = useState(false);

  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (q.trim()) params.set('q', q.trim());
  if (status) params.set('status', status);
  if (category) params.set('category', category);
  if (fine) params.set('fine', fine);

  const list = useQuery({
    queryKey: ['admin', 'works-manage', params.toString()],
    queryFn: () => apiFetchPage<Row[]>(`/admin/works?${params.toString()}`),
  });

  const rows = list.data?.data ?? [];
  const allChecked = rows.length > 0 && rows.every((r) => sel.has(r.id));

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSel((s) => {
      const n = new Set(s);
      if (allChecked) rows.forEach((r) => n.delete(r.id));
      else rows.forEach((r) => n.add(r.id));
      return n;
    });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'works-manage'] });
    qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
  };

  const batch = useMutation({
    mutationFn: (action: 'publish' | 'takeDown' | 'setFine' | 'setFree' | 'delete') =>
      apiFetch<{ done: number; total: number; errors?: string[] }>('/admin/works/batch', {
        method: 'POST',
        body: JSON.stringify({ ids: [...sel], action }),
      }),
    onSuccess: (r: { done: number; total: number; errors?: string[] }) => {
      invalidate();
      toast(
        `已处理 ${r.done}/${r.total} 条${r.errors?.length ? `（${r.errors[0]}…）` : ''}`,
        r.done === r.total ? 'ok' : 'warn',
      );
      setSel(new Set());
      setZonePicking(false);
    },
    onError: (e) =>
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '操作失败', 'warn'),
  });

  const single = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/admin/works/${id}/manage`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      invalidate();
      toast('已调整', 'ok');
    },
    onError: (e) =>
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '操作失败', 'warn'),
  });

  const del = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/works/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason: '管理员资料管理删除' }),
      }),
    onSuccess: () => {
      invalidate();
      toast('已删除（软删）', 'ok');
      setSel((s) => new Set(s));
    },
    onError: (e) =>
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '删除失败', 'warn'),
  });

  return (
    <div>
      {/* 筛选栏 */}
      <div className="ops-filter" style={{ marginBottom: 12 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <input
            className="input"
            style={{ width: 200 }}
            placeholder="搜索标题…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="input"
            style={{ width: 130 }}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部状态</option>
            {Object.keys(STATUS_LABEL).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            className="input"
            style={{ width: 130 }}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部分类</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
          <select
            className="input"
            style={{ width: 130 }}
            value={fine}
            onChange={(e) => {
              setFine(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部分区</option>
            <option value="false">💎 自我提升区（精品位）</option>
            <option value="true">🏫 校园专区（普通流）</option>
          </select>
        </form>
      </div>

      {/* 批量操作条 */}
      {sel.size > 0 && (
        <div
          className="card"
          style={{
            padding: '10px 14px',
            marginBottom: 12,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <b style={{ marginRight: 4 }}>已选 {sel.size} 条</b>
          <button className="btn btn-primary btn-sm" onClick={() => setZonePicking(true)}>
            批量上线（选分区）
          </button>
          <button className="btn btn-light btn-sm" onClick={() => batch.mutate('takeDown')}>
            批量下架
          </button>
          <button className="btn btn-light btn-sm" onClick={() => batch.mutate('setFine')}>
            移到精品位
          </button>
          <button className="btn btn-light btn-sm" onClick={() => batch.mutate('setFree')}>
            移到普通流
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--danger)' }}
            onClick={() => {
              if (confirm(`确认删除 ${sel.size} 条资料？（软删，可从数据库恢复）`))
                batch.mutate('delete');
            }}
          >
            批量删除
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSel(new Set())}>
            取消选择
          </button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input type="checkbox" checked={allChecked} onChange={toggleAll} />
              </th>
              <th>资料</th>
              <th>分类</th>
              <th>分区</th>
              <th>状态</th>
              <th>下载/收藏/观看</th>
              <th>日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 20 }}>
                  加载中…
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((w) => (
                <tr key={w.id}>
                  <td>
                    <input type="checkbox" checked={sel.has(w.id)} onChange={() => toggle(w.id)} />
                  </td>
                  <td>
                    <Link href={`/work/${w.id}`} style={{ fontWeight: 600 }}>
                      {w.coverIcon} {w.title}
                    </Link>
                    <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                      {w.course} · {w.author.username}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {CATEGORY_LABEL[w.category as CategoryKey] ?? w.category}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {w.isFree ? (
                      <span style={{ color: 'var(--ink-soft)' }}>🏫 普通</span>
                    ) : (
                      <span style={{ color: 'var(--fine, #b8860b)', fontWeight: 600 }}>
                        💎 精品
                      </span>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{STATUS_LABEL[w.status] ?? w.status}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {w.downloads} / {w.favs} / {w.views}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--ink-soft)' }}>
                    {new Date(w.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => single.mutate({ id: w.id, body: { isFree: !w.isFree } })}
                    >
                      {w.isFree ? '→ 精品位' : '→ 普通流'}
                    </button>{' '}
                    {w.status === 'PUBLISHED' ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => single.mutate({ id: w.id, body: { status: 'TAKEN_DOWN' } })}
                      >
                        下架
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => single.mutate({ id: w.id, body: { status: 'PUBLISHED' } })}
                      >
                        上架
                      </button>
                    )}{' '}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => {
                        if (confirm(`删除「${w.title}」？（软删）`)) del.mutate(w.id);
                      }}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}
                >
                  无匹配资料
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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

      {/* 批量上线：选分区 */}
      <Modal open={zonePicking} onClose={() => setZonePicking(false)}>
        <ModalHead title={`上线 ${sel.size} 条资料`} onClose={() => setZonePicking(false)} />
        <ModalBody>
          <p style={{ marginTop: 0, color: 'var(--ink-soft)' }}>
            选择上线后放在哪个分区（全站免费模式下仅决定展示位置，下载一律免费）：
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            <button
              className="btn btn-light"
              style={{ textAlign: 'left', padding: '12px 16px' }}
              onClick={() => {
                // 先统一分区再上架，一次到位
                apiFetch('/admin/works/batch', {
                  method: 'POST',
                  body: JSON.stringify({ ids: [...sel], action: 'setFine' }),
                })
                  .then(() => batch.mutate('publish'))
                  .catch(() => toast('操作失败', 'warn'));
              }}
            >
              💎 自我提升区（精品位）
              <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                首页自我提升区展示，作为精选门面
              </div>
            </button>
            <button
              className="btn btn-light"
              style={{ textAlign: 'left', padding: '12px 16px' }}
              onClick={() => {
                apiFetch('/admin/works/batch', {
                  method: 'POST',
                  body: JSON.stringify({ ids: [...sel], action: 'setFree' }),
                })
                  .then(() => batch.mutate('publish'))
                  .catch(() => toast('操作失败', 'warn'));
              }}
            >
              🏫 校园专区（普通流）
              <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                进入分类浏览与首页推荐流
              </div>
            </button>
          </div>
        </ModalBody>
        <ModalFoot>
          <button className="btn btn-light" onClick={() => setZonePicking(false)}>
            取消
          </button>
        </ModalFoot>
      </Modal>
    </div>
  );
}
