'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetchPage } from '@/lib/api/client';
import { CATEGORIES } from '@/lib/constants';
import type { WorkListItem } from '@/lib/types';

/**
 * 各大类公开作品计数（侧栏分类目录用）。
 * 并行 pageSize=1 的 total 查询，60s 内多区块共享缓存；explore 页计数逻辑的同款封装。
 */
export function useCategoryCounts() {
  return useQuery({
    queryKey: ['works', 'category-counts'],
    queryFn: async () => {
      const entries = await Promise.all(
        CATEGORIES.map(async (c) => {
          const r = await apiFetchPage<WorkListItem[]>(
            `/works?category=${c.key}&page=1&pageSize=1`,
          );
          return [c.key, r.pagination.total] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
    staleTime: 60_000,
  });
}
