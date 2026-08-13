'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useCreatorOverview, useCreatorData, useMyWorks } from '@/hooks/useIncome';
import { formatCny, formatNum } from '@/lib/format';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '审核中',
  PUBLISHED: '已上架',
  REJECTED: '已驳回',
  TAKEN_DOWN: '已下架',
};

export default function CreatorCenterPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'overview' | 'works' | 'data'>('overview');
  const { data: overview } = useCreatorOverview();
  const { data: works } = useMyWorks();
  const { data: data } = useCreatorData();

  if (user && !user.creator?.verified) {
    return (
      <main className="page">
        <div className="empty">
          <div className="e-ic">🎨</div>
          <div className="e-title">尚未成为创作者</div>
          <div className="e-desc">申请创作者身份后，即可发布作品并获得收益。</div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>创作者中心</h1>
          <div className="sub">分享知识 → 帮助同学 → 获得影响力 → 获得收益</div>
        </div>
        <div className="right">
          <Link className="btn btn-primary" href="/upload">
            发布作品
          </Link>
          <Link className="btn btn-ghost" href="/income">
            我的收益
          </Link>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 18 }}>
        <button
          className={`tab-btn ${tab === 'overview' ? 'active' : ''}`}
          onClick={() => setTab('overview')}
        >
          概览
        </button>
        <button
          className={`tab-btn ${tab === 'works' ? 'active' : ''}`}
          onClick={() => setTab('works')}
        >
          我的作品
        </button>
        <button
          className={`tab-btn ${tab === 'data' ? 'active' : ''}`}
          onClick={() => setTab('data')}
        >
          数据中心
        </button>
      </div>

      {tab === 'overview' ? (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="lb">已帮助</div>
              <div className="v">{formatNum(overview?.helped)}</div>
            </div>
            <div className="stat-card">
              <div className="lb">累计收益</div>
              <div className="v">{formatCny(overview?.income.total)}</div>
            </div>
            <div className="stat-card">
              <div className="lb">粉丝</div>
              <div className="v">{formatNum(overview?.fans)}</div>
            </div>
            <div className="stat-card">
              <div className="lb">好评</div>
              <div className="v">{overview?.avgRating}</div>
            </div>
          </div>
          <div className="stat-grid" style={{ marginTop: 14 }}>
            <div className="stat-card">
              <div className="lb">作品</div>
              <div className="v">{overview?.works}</div>
            </div>
            <div className="stat-card">
              <div className="lb">免费作品</div>
              <div className="v">{overview?.freeWorks}</div>
            </div>
            <div className="stat-card">
              <div className="lb">精品作品</div>
              <div className="v">{overview?.fineWorks}</div>
            </div>
            <div className="stat-card">
              <div className="lb">可提现</div>
              <div className="v">{formatCny(overview?.income.withdrawable)}</div>
            </div>
          </div>
        </>
      ) : tab === 'works' ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>作品</th>
                <th>状态</th>
                <th>下载</th>
                <th>评分</th>
                <th>收益</th>
              </tr>
            </thead>
            <tbody>
              {works?.length ? (
                works.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <Link href={`/work/${w.id}`} style={{ fontWeight: 600 }}>
                        {w.title}
                      </Link>
                    </td>
                    <td>{STATUS_LABEL[w.status] ?? w.status}</td>
                    <td>{w.downloads}</td>
                    <td>{w.rating}</td>
                    <td>{formatCny(w.earnings)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}
                  >
                    暂无作品
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
                <th>作品</th>
                <th>浏览</th>
                <th>下载</th>
                <th>收藏</th>
                <th>评分</th>
                <th>收益</th>
              </tr>
            </thead>
            <tbody>
              {data?.works?.length ? (
                data.works.map((w) => (
                  <tr key={w.id}>
                    <td>{w.title}</td>
                    <td>{w.views}</td>
                    <td>{w.downloads}</td>
                    <td>{w.favs}</td>
                    <td>{w.rating}</td>
                    <td>{formatCny(w.earnings)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}
                  >
                    暂无数据
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
