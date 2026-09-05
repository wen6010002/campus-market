'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, apiFetchPage } from '@/lib/api/client';
import { WorkCard } from '@/components/work/WorkCard';
import { FineCard } from '@/components/work/FineCard';
import { Empty } from '@/components/common/Empty';
import { CATEGORIES, PRESET_TAGS, FREE_MODE } from '@/lib/constants';
import type { CategoryKey } from '@/lib/constants';
import type { WorkListItem } from '@/lib/types';

const SORTS = [
  { key: 'complex', label: '综合' },
  { key: 'hot', label: '最热' },
  { key: 'new', label: '最新' },
  { key: 'rate', label: '好评' },
] as const;

const PRICES = [
  { key: 'all', label: '全部' },
  { key: 'free', label: '免费' },
  { key: 'fine', label: '精品' },
] as const;

export default function ExplorePage() {
  return (
    <Suspense fallback={<main className="page">加载中…</main>}>
      <ExploreContent />
    </Suspense>
  );
}

function ExploreContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const cat = sp.get('cat') ?? '';
  const tag = sp.get('tag') ?? '';
  const course = sp.get('course') ?? '';
  const sort = sp.get('sort') ?? 'complex';
  const price = sp.get('price') ?? 'all';

  const setParam = (k: string, v: string) => {
    const q = new URLSearchParams(sp.toString());
    if (v) q.set(k, v);
    else q.delete(k);
    // 切大类时联动重置二级筛选
    if (k === 'cat') {
      q.delete('tag');
      q.delete('course');
    }
    router.replace(`/explore?${q.toString()}`);
  };

  const works = useQuery({
    queryKey: ['explore', cat, tag, course, sort, price],
    queryFn: () =>
      apiFetchPage<WorkListItem[]>(
        `/works?${new URLSearchParams({
          page: '1',
          pageSize: '40',
          sort,
          ...(cat ? { category: cat } : {}),
          ...(tag ? { tag } : {}),
          ...(course ? { course } : {}),
          ...(price === 'free' ? { isFree: 'true' } : {}),
          ...(price === 'fine' ? { isFree: 'false' } : {}),
        }).toString()}`,
      ),
  });

  // 大类作品数（并行 6 次 total 查询）
  const catCounts = useQuery({
    queryKey: ['explore', 'counts'],
    queryFn: async () => {
      const entries = await Promise.all(
        CATEGORIES.map(async (c) => {
          const r = await apiFetchPage<WorkListItem[]>(`/works?category=${c.key}&pageSize=1`);
          return [c.key, r.pagination.total] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
    staleTime: 60_000,
  });

  const courses = useQuery({
    queryKey: ['explore', 'courses', cat],
    queryFn: () =>
      apiFetch<{ course: string; count: number }[]>(
        `/works/courses${cat ? `?category=${cat}` : ''}`,
      ),
    staleTime: 60_000,
  });

  // 预设标签跟随大类：未选大类时聚合展示全部大类的前几个
  // 2026-09：结合 availableTags 只显示该分类下有真实作品的标签（自动隐藏空标签）
  const presetBase = cat
    ? PRESET_TAGS[cat as CategoryKey]
    : (Object.values(PRESET_TAGS) as string[][]).flat().slice(0, 14);
  const availQuery = useQuery({
    queryKey: ['works', 'tags', cat],
    queryFn: async () => {
      const rows = await apiFetch<{ name: string; count: number }[]>(
        `/works/tags${cat ? `?category=${cat}` : ''}`,
      );
      return new Map(rows.map((t) => [t.name, t.count]));
    },
    staleTime: 60_000,
  });
  const presetTags = availQuery.data
    ? presetBase.filter((t) => (availQuery.data!.get(t) ?? 0) > 0)
    : presetBase;

  useEffect(() => {
    document.title = '分类浏览 · 课搭';
  }, []);

  const total = works.data?.pagination.total ?? 0;

  return (
    <main className="page explore-layout">
      <aside className="explore-side">
        <div className="es-title">用途分类</div>
        <button className={`es-item ${!cat ? 'active' : ''}`} onClick={() => setParam('cat', '')}>
          <span className="es-ico">🗂️</span>
          <span className="es-txt">
            <b>全部</b>
            <small>所有资料</small>
          </span>
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            className={`es-item ${cat === c.key ? 'active' : ''}`}
            onClick={() => setParam('cat', c.key)}
          >
            <span className="es-ico">{c.icon}</span>
            <span className="es-txt">
              <b>{c.label}</b>
              <small>
                {c.desc}
                {catCounts.data ? ` · ${catCounts.data[c.key]} 份` : ''}
              </small>
            </span>
          </button>
        ))}
      </aside>

      <div className="explore-main">
        <div className="page-head" style={{ marginBottom: 14 }}>
          <div>
            <h1>分类浏览</h1>
            <div className="sub">
              {cat ? CATEGORIES.find((c) => c.key === cat)?.label : '全部资料'} · 共 {total} 份
            </div>
          </div>
        </div>

        <div className="explore-filters">
          <div className="chips">
            {presetTags.map((t) => (
              <span
                key={t}
                className={`chip ${tag === t ? 'active' : ''}`}
                onClick={() => setParam('tag', tag === t ? '' : t)}
              >
                {t}
              </span>
            ))}
          </div>
          {courses.data?.length ? (
            <div className="chips" style={{ marginTop: 8 }}>
              {courses.data.slice(0, 10).map((c) => (
                <span
                  key={c.course}
                  className={`chip gray ${course === c.course ? 'active' : ''}`}
                  onClick={() => setParam('course', course === c.course ? '' : c.course)}
                >
                  {c.course} · {c.count}
                </span>
              ))}
            </div>
          ) : null}
          <div className="explore-toolbar">
            <div className="tabs" style={{ borderBottom: 'none', gap: 4 }}>
              {PRICES.filter((p) => !FREE_MODE || p.key === 'all').map((p) => (
                <button
                  key={p.key}
                  className={`tab-btn ${price === p.key ? 'active' : ''}`}
                  onClick={() => setParam('price', p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="tabs" style={{ borderBottom: 'none', gap: 4, marginLeft: 'auto' }}>
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  className={`tab-btn ${sort === s.key ? 'active' : ''}`}
                  onClick={() => setParam('sort', s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {works.isLoading ? (
          <div style={{ color: 'var(--ink-soft)', padding: '40px 0', textAlign: 'center' }}>
            加载中…
          </div>
        ) : total ? (
          <div className="card-grid">
            {(works.data?.data ?? []).map((w) =>
              w.isFree ? <WorkCard key={w.id} work={w} /> : <FineCard key={w.id} work={w} />,
            )}
          </div>
        ) : (
          <Empty icon="🗂️" title="该分类下还没有资料" desc="换个分类或标签看看" />
        )}
      </div>
    </main>
  );
}
