'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetchPage } from '@/lib/api/client';
import { CATEGORIES } from '@/lib/constants';
import type { WorkListItem } from '@/lib/types';

/**
 * V10 刊头（masthead）+ 分类行：博客门面。
 * 总收录数取 works 列表 total（pageSize=1 的轻查询，React Query 缓存复用）。
 * 「本周新增」一期不做（API 无时间范围过滤，不为装饰数字加后端参数）。
 */
export function Masthead() {
  const total = useQuery({
    queryKey: ['works', 'list', { page: 1, pageSize: 1 }],
    queryFn: () => apiFetchPage<WorkListItem[]>('/works?page=1&pageSize=1'),
    staleTime: 60_000,
  });

  return (
    <header>
      <div className="blog-mast">
        <div className="blog-mast-main">
          <div className="bm-kicker">Campus Materials Blog · 校园资料博客</div>
          <h1>
            找资料，先来<em>课搭</em>
          </h1>
          <p className="bm-tagline">
            课程真题、留学文书、求职模板、成长路线——每一份都来自学长学姐的真实整理，署名可溯。
          </p>
        </div>
        <div className="blog-mast-side">
          2026 秋季学期 · 开学季
          <br />
          {total.data ? (
            <>
              共收录资料 <span className="bm-count">{total.data.pagination.total}</span> 份
            </>
          ) : null}
        </div>
      </div>
      <div className="bm-rule" />
      <nav className="blog-cats" aria-label="分类浏览">
        <span className="bc-label">📚 分类</span>
        <Link className="bc-chip on" href="/explore">
          全部
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c.key} className="bc-chip" href={`/explore?cat=${c.key}`}>
            {c.icon} {c.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
