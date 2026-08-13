'use client';

import { useState } from 'react';
import { useIncomeSummary, useIncomeTransactions, usePayouts } from '@/hooks/useIncome';
import { WithdrawModal } from '@/components/form/WithdrawModal';
import { formatCny, timeAgo } from '@/lib/format';

export default function IncomePage() {
  const [tab, setTab] = useState<'transactions' | 'withdraw'>('transactions');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const { data: summary } = useIncomeSummary();
  const { data: transactions } = useIncomeTransactions();
  const { data: payouts } = usePayouts();

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>我的收益</h1>
          <div className="sub">平台抽成 10%，收益 T+7 自动结算到可提现余额</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="lb">累计收益</div>
          <div className="v">{formatCny(summary?.total)}</div>
        </div>
        <div className="stat-card">
          <div className="lb">本月收益</div>
          <div className="v">{formatCny(summary?.month)}</div>
        </div>
        <div className="stat-card">
          <div className="lb">待结算</div>
          <div className="v">{formatCny(summary?.pending)}</div>
        </div>
        <div className="stat-card">
          <div className="lb">可提现</div>
          <div className="v">{formatCny(summary?.withdrawable)}</div>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => setWithdrawOpen(true)}
          >
            提现
          </button>
        </div>
      </div>

      <div className="tabs" style={{ margin: '20px 0 16px' }}>
        <button
          className={`tab-btn ${tab === 'transactions' ? 'active' : ''}`}
          onClick={() => setTab('transactions')}
        >
          收益明细
        </button>
        <button
          className={`tab-btn ${tab === 'withdraw' ? 'active' : ''}`}
          onClick={() => setTab('withdraw')}
        >
          提现记录
        </button>
      </div>

      {tab === 'transactions' ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>作品</th>
                <th>购买者</th>
                <th>方式</th>
                <th>金额</th>
                <th>时间</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {transactions?.length ? (
                transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.workTitle}</td>
                    <td>{t.buyer}</td>
                    <td>{t.method}</td>
                    <td>{formatCny(t.amount)}</td>
                    <td>{timeAgo(t.createdAt)}</td>
                    <td>
                      {t.status === 'PENDING'
                        ? '待结算'
                        : t.status === 'SETTLED'
                          ? '已结算'
                          : '已提现'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}
                  >
                    暂无收益
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
                <th>金额</th>
                <th>方式</th>
                <th>申请时间</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {payouts?.length ? (
                payouts.map((p) => (
                  <tr key={p.id}>
                    <td>{formatCny(p.amount)}</td>
                    <td>{p.method}</td>
                    <td>{timeAgo(p.requestedAt)}</td>
                    <td>
                      {p.status === 'COMPLETED'
                        ? '已到账'
                        : p.status === 'REJECTED'
                          ? '已拒绝'
                          : '处理中'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}
                  >
                    暂无提现记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <WithdrawModal
        open={withdrawOpen}
        withdrawable={summary?.withdrawable ?? '0.00'}
        onClose={() => setWithdrawOpen(false)}
        onSuccess={() => setWithdrawOpen(false)}
      />
    </main>
  );
}
