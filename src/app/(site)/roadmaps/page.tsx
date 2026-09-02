'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRoadmaps } from '@/hooks/useRoadmaps';
import { RoadmapCard } from '@/components/roadmap/RoadmapCard';
import { Empty } from '@/components/common/Empty';
import { useAuth } from '@/hooks/useAuth';
import { ROADMAP_CATEGORIES } from '@/lib/constants';

export default function RoadmapsPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<'favs' | 'newest'>('favs');
  const [page, setPage] = useState(1);

  const list = useRoadmaps({
    page,
    pageSize: 12,
    category: category || undefined,
    sort,
  });

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>学习路线图</h1>
          <div className="sub">阶段化学习路径 · 每日打卡 · 路线尾附配套资料</div>
        </div>
        <Link
          className="btn btn-primary"
          href={user ? '/roadmaps/upload' : '/login?from=/roadmaps/upload'}
        >
          <span style={{ marginRight: 4 }}>＋</span>上传路线图
        </Link>
      </div>

      <div className="rm-toolbar">
        <nav className="cat-quick" aria-label="方向筛选" style={{ flex: 1, boxShadow: 'none' }}>
          <button
            className={`cq-chip ${!category ? 'active' : ''}`}
            onClick={() => {
              setCategory('');
              setPage(1);
            }}
          >
            全部
          </button>
          {ROADMAP_CATEGORIES.map((c) => (
            <button
              key={c.key}
              className={`cq-chip ${category === c.key ? 'active' : ''}`}
              onClick={() => {
                setCategory(c.key);
                setPage(1);
              }}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </nav>
        <div className="tabs" style={{ margin: 0 }}>
          {(
            [
              { key: 'favs', label: '最热' },
              { key: 'newest', label: '最新' },
            ] as const
          ).map((s) => (
            <button
              key={s.key}
              className={`tab-btn ${sort === s.key ? 'active' : ''}`}
              onClick={() => {
                setSort(s.key);
                setPage(1);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {list.isLoading ? (
        <div className="card">加载中…</div>
      ) : list.data?.data.length ? (
        <div className="rm-grid">
          {list.data.data.map((r) => (
            <RoadmapCard key={r.id} roadmap={r} />
          ))}
        </div>
      ) : (
        <Empty
          icon="🗺"
          title={category ? '该方向暂无路线图' : '暂无路线图'}
          desc="还没有同学上传该方向的学习路线，来成为第一个吧"
          action={
            <Link
              className="btn btn-primary"
              href={user ? '/roadmaps/upload' : '/login?from=/roadmaps/upload'}
            >
              上传路线图
            </Link>
          }
        />
      )}

      {list.data && list.data.pagination.totalPages > 1 ? (
        <div className="ops-pager">
          <span className="ops-pager-total">共 {list.data.pagination.total} 张路线图</span>
          <button className="btn btn-light btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
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
    </main>
  );
}
