'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { OpsGuard, Pager } from '@/components/ops/OpsGuard';
import { apiFetchPage } from '@/lib/api/client';

type AdminOrderRow = {
  id: string;
  amount: string;
  platformFee: string;
  creatorAmount: string;
  payMethod: string;
  payStatus: string;
  transactionId: string | null;
  paidAt: string | null;
  createdAt: string;
  work: { id: string; title: string };
  buyer: { id: string; username: string };
};

const PAY_STATUS: { key: string; label: string }[] = [
  { key: '', label: '全部状态' },
  { key: 'PENDING', label: '待支付' },
  { key: 'PAID', label: '已支付' },
  { key: 'REFUNDED', label: '已退款' },
  { key: 'CLOSED', label: '已关闭' },
  { key: 'FAILED', label: '支付失败' },
];

const PAY_STATUS_LABEL: Record<string, string> = {
  PENDING: '待支付',
  PAID: '已支付',
  REFUNDED: '已退款',
  CLOSED: '已关闭',
  FAILED: '支付失败',
};

const METHOD_LABEL: Record<string, string> = {
  WECHAT: '微信',
  ALIPAY: '支付宝',
  MOCK: '模拟',
};

export default function OpsOrdersPage() {
  const [payStatus, setPayStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const list = useQuery({
    queryKey: ['ops', 'orders', { payStatus, q, page }],
    queryFn: () =>
      apiFetchPage<AdminOrderRow[]>(
        `/admin/orders?payStatus=${payStatus}&q=${encodeURIComponent(q)}&page=${page}&pageSize=20`,
      ),
  });

  return (
    <OpsGuard backHref="/ops">
      <main className="page">
        <div className="page-head">
          <div>
            <h1>订单管理</h1>
            <div className="sub">全站交易流水查看（只读）</div>
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
            placeholder="搜索订单号 / 资料 / 买家"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="input"
            value={payStatus}
            onChange={(e) => {
              setPayStatus(e.target.value);
              setPage(1);
            }}
          >
            {PAY_STATUS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" type="submit">
            搜索
          </button>
        </form>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>订单号</th>
                <th>资料</th>
                <th>买家</th>
                <th>金额</th>
                <th>抽成</th>
                <th>方式</th>
                <th>状态</th>
                <th>支付时间</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>
                    加载中…
                  </td>
                </tr>
              ) : list.data?.data.length ? (
                list.data.data.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>
                      {o.id.slice(0, 14)}…
                    </td>
                    <td>
                      <Link
                        href={`/work/${o.work.id}`}
                        target="_blank"
                        style={{ color: 'var(--pri-600)' }}
                      >
                        {o.work.title}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/ops/users/${o.buyer.id}`} style={{ color: 'var(--ink)' }}>
                        {o.buyer.username}
                      </Link>
                    </td>
                    <td style={{ fontWeight: 600 }}>¥{o.amount}</td>
                    <td style={{ color: 'var(--ink-soft)' }}>¥{o.platformFee}</td>
                    <td>{METHOD_LABEL[o.payMethod] ?? o.payMethod}</td>
                    <td>
                      <span className={`up-status ${o.payStatus}`}>
                        {PAY_STATUS_LABEL[o.payStatus] ?? o.payStatus}
                      </span>
                    </td>
                    <td style={{ color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                      {o.paidAt ? new Date(o.paidAt).toLocaleString('zh-CN') : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>
                    没有匹配的订单
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
      </main>
    </OpsGuard>
  );
}
