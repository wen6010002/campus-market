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
import { FREE_MODE } from '@/lib/constants';

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [transferReason, setTransferReason] = useState('经原作者授权转移资料归属');
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

  const transfer = useMutation({
    mutationFn: () =>
      apiFetch<{ count: number; target: { username: string; email: string } }>(
        '/admin/works/transfer',
        {
          method: 'POST',
          body: JSON.stringify({ workIds: selectedIds, targetEmail, reason: transferReason }),
        },
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ops', 'works'] });
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast(`已将 ${data.count} 份资料转移给 ${data.target.username}`, 'ok');
      setSelectedIds([]);
      setTransferOpen(false);
      setTargetEmail('');
    },
    onError: (e) =>
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '转移失败', 'warn'),
  });

  const pageIds = list.data?.data.map((work) => work.id) ?? [];
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  return (
    <OpsGuard backHref="/ops">
      <main className="page">
        <div className="page-head">
          <div>
            <h1>
              资料管理{authorId ? `（作者 ${list.data?.data[0]?.author.username ?? ''}）` : ''}
            </h1>
            <div className="sub">全量资料查看 · 选择资料转移归属 · 删除违规资料</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              disabled={!selectedIds.length}
              onClick={() => setTransferOpen(true)}
            >
              转移所选资料{selectedIds.length ? `（${selectedIds.length}）` : ''}
            </button>
            <Link className="btn btn-light" href="/ops">
              ← 返回控制台
            </Link>
          </div>
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
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
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
                <th style={{ width: 42 }}>
                  <input
                    type="checkbox"
                    aria-label="选择本页全部资料"
                    checked={allPageSelected}
                    onChange={(e) => {
                      setSelectedIds((current) =>
                        e.target.checked
                          ? [...new Set([...current, ...pageIds])]
                          : current.filter((id) => !pageIds.includes(id)),
                      );
                    }}
                  />
                </th>
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
                  <td
                    colSpan={8}
                    style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}
                  >
                    加载中…
                  </td>
                </tr>
              ) : list.data?.data.length ? (
                list.data.data.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`选择资料 ${w.title}`}
                        checked={selectedIds.includes(w.id)}
                        onChange={(e) =>
                          setSelectedIds((current) =>
                            e.target.checked
                              ? [...current, w.id]
                              : current.filter((id) => id !== w.id),
                          )
                        }
                      />
                    </td>
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
                      ) : FREE_MODE ? (
                        // V7 全站免费：价格仅数据保留，展示分区语义避免误导
                        <span style={{ color: 'var(--fine)', fontWeight: 600 }}>
                          💎 精品（免费下）
                        </span>
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
                        title={
                          w.status === 'PENDING' ? '待审核资料请在管理后台审核处理' : undefined
                        }
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
              onClick={() =>
                deleting && remove.mutate({ id: deleting.id, reason: delReason || undefined })
              }
              disabled={remove.isPending}
            >
              {remove.isPending ? '删除中…' : '确认删除'}
            </button>
          </ModalFoot>
        </Modal>

        <Modal open={transferOpen} onClose={() => !transfer.isPending && setTransferOpen(false)}>
          <ModalHead
            title={`转移 ${selectedIds.length} 份资料`}
            onClose={() => setTransferOpen(false)}
          />
          <ModalBody>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: '0 0 14px' }}>
              资料、评论、评分和下载记录会保留。历史订单及已产生收入仍归原作者，转移后的新收入归接收账号。
            </p>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>接收账号邮箱</span>
              <input
                className="input"
                type="email"
                autoComplete="off"
                placeholder="请输入已开通创作者身份的账号邮箱"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
              />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
                转移原因 / 授权说明
              </span>
              <textarea
                className="input"
                rows={3}
                maxLength={300}
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
              />
            </label>
          </ModalBody>
          <ModalFoot>
            <button
              className="btn btn-light"
              onClick={() => setTransferOpen(false)}
              disabled={transfer.isPending}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={() => transfer.mutate()}
              disabled={
                transfer.isPending || !targetEmail.trim() || transferReason.trim().length < 2
              }
            >
              {transfer.isPending ? '转移中…' : '确认转移'}
            </button>
          </ModalFoot>
        </Modal>
      </main>
    </OpsGuard>
  );
}
