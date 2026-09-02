'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OpsGuard, Pager } from '@/components/ops/OpsGuard';
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/common/Modal';
import { apiFetch, apiFetchPage, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { toast } from '@/stores/ui';

type AdminWorkRow = {
  id: string;
  title: string;
  course: string;
  coverIcon: string;
  category: string;
  isFree: boolean;
  price: string;
  status: string;
  quality: string;
  downloads: number;
  favs: number;
  views: number;
  createdAt: string;
  publishedAt: string | null;
  author: { id: string; username: string; avatarColor: string; avatarKey?: string | null };
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '审核中',
  PUBLISHED: '已上架',
  REJECTED: '已驳回',
  TAKEN_DOWN: '已下架',
};

export default function OpsWorksPage() {
  return (
    <Suspense fallback={<main className="page">加载中…</main>}>
      <OpsWorksContent />
    </Suspense>
  );
}

function OpsWorksContent() {
  const qc = useQueryClient();
  const sp = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<AdminWorkRow | null>(null);
  const [delReason, setDelReason] = useState('');
  const authorId = sp.get('authorId') ?? undefined;

  const list = useQuery({
    queryKey: ['ops', 'works', { q, status, page, authorId }],
    queryFn: () =>
      apiFetchPage<AdminWorkRow[]>(
        `/admin/works?q=${encodeURIComponent(q)}&status=${status}&page=${page}&pageSize=20${
          authorId ? `&authorId=${authorId}` : ''
        }`,
      ),
  });

  const remove = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiFetch(`/works/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'works'] });
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast('已删除（软删，可从数据库恢复）', 'ok');
      setDeleting(null);
      setDelReason('');
    },
    onError: (e) =>
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '删除失败', 'warn'),
  });

  return (
    <OpsGuard backHref="/ops">
      <main className="page">
        <div className="page-head">
          <div>
            <h1>资料管理{authorId ? `（作者 ${list.data?.data[0]?.author.username ?? ''}）` : ''}</h1>
            <div className="sub">全量资料查看 · 删除违规资料（软删除，保留审计记录）</div>
          </div>
          <Link className="btn btn-light" href="/ops">
            ← 返回控制台
          </Link>
        </div>

        <form
          className="ops-filter"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            list.refetch();
          }}
        >
          <input
            className="input"
            placeholder="搜索资料标题"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">全部状态</option>
            <option value="PUBLISHED">已上架</option>
            <option value="PENDING">审核中</option>
            <option value="REJECTED">已驳回</option>
            <option value="TAKEN_DOWN">已下架</option>
            <option value="DRAFT">草稿</option>
          </select>
          <button className="btn btn-primary" type="submit">
            搜索
          </button>
        </form>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>资料</th>
                <th>作者</th>
                <th>状态</th>
                <th>价格</th>
                <th>下载/收藏/浏览</th>
                <th>发布时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>
                    加载中…
                  </td>
                </tr>
              ) : list.data?.data.length ? (
                list.data.data.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <Link
                        href={`/work/${w.id}`}
                        target="_blank"
                        style={{ color: 'var(--pri-600)', fontWeight: 600 }}
                      >
                        {w.coverIcon} {w.title}
                      </Link>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{w.course}</div>
                    </td>
                    <td>
                      <Link href={`/ops/users/${w.author.id}`} style={{ color: 'var(--ink)' }}>
                        {w.author.username}
                      </Link>
                    </td>
                    <td>
                      <span className={`up-status ${w.status}`}>
                        {STATUS_LABEL[w.status] ?? w.status}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {w.isFree ? (
                        <span style={{ color: 'var(--mint)', fontWeight: 600 }}>免费</span>
                      ) : (
                        <span style={{ color: 'var(--fine)', fontWeight: 600 }}>¥{w.price}</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                      {w.downloads} / {w.favs} / {w.views}
                    </td>
                    <td style={{ color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                      {w.publishedAt
                        ? new Date(w.publishedAt).toLocaleDateString('zh-CN')
                        : new Date(w.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setDeleting(w)}
                        disabled={w.status === 'PENDING'}
                        title={w.status === 'PENDING' ? '待审核资料请在管理后台审核处理' : undefined}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>
                    没有匹配的资料
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

        <Modal open={!!deleting} onClose={() => setDeleting(null)}>
          <ModalHead title={`删除资料「${deleting?.title}」`} onClose={() => setDeleting(null)} />
          <ModalBody>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: '0 0 10px' }}>
              删除后前台立即不可见（软删除），删除原因会写入审计日志。该操作在界面上不可撤销。
            </p>
            <textarea
              className="input"
              rows={3}
              maxLength={600}
              placeholder="删除原因（写入审计日志，选填）"
              value={delReason}
              onChange={(e) => setDelReason(e.target.value)}
            />
          </ModalBody>
          <ModalFoot>
            <button className="btn btn-light" onClick={() => setDeleting(null)}>
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={() => deleting && remove.mutate({ id: deleting.id, reason: delReason || undefined })}
              disabled={remove.isPending}
            >
              {remove.isPending ? '删除中…' : '确认删除'}
            </button>
          </ModalFoot>
        </Modal>
      </main>
    </OpsGuard>
  );
}
