'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchPage } from '@/lib/api/client';
import type { RoadmapListItem, RoadmapDetail, RoadmapProgress } from '@/lib/types';

export function useRoadmaps(params: {
  page?: number;
  pageSize?: number;
  category?: string;
  sort?: 'favs' | 'newest';
}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params.category) qs.set('category', params.category);
  if (params.sort) qs.set('sort', params.sort);
  return useQuery({
    queryKey: ['roadmaps', 'list', params],
    queryFn: () => apiFetchPage<RoadmapListItem[]>(`/roadmaps?${qs.toString()}`),
  });
}

export function useRoadmap(id: string) {
  return useQuery({
    queryKey: ['roadmaps', 'detail', id],
    queryFn: () => apiFetch<RoadmapDetail>(`/roadmaps/${id}`),
    enabled: !!id,
  });
}

export function useRoadmapFavorite(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: boolean) =>
      apiFetch(`/roadmaps/${id}/favorite`, { method: value ? 'POST' : 'DELETE' }),
    onMutate: async (value) => {
      // 乐观更新详情里的 myFav/favs
      await qc.cancelQueries({ queryKey: ['roadmaps', 'detail', id] });
      const prev = qc.getQueryData<RoadmapDetail>(['roadmaps', 'detail', id]);
      if (prev) {
        qc.setQueryData<RoadmapDetail>(['roadmaps', 'detail', id], () => ({
          ...prev,
          myFav: value,
          favs: Math.max(prev.favs + (value ? 1 : -1), 0),
        }));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['roadmaps', 'detail', id], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['roadmaps'] });
    },
  });
}

export function useRoadmapCheck(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { stepId: string; checked: boolean }) =>
      apiFetch(`/roadmaps/${id}/check`, { method: 'POST', body: JSON.stringify(input) }),
    onMutate: async ({ stepId, checked }) => {
      // 乐观更新进度（勾选列表 + 按日聚合 + 总数）
      await qc.cancelQueries({ queryKey: ['roadmaps', 'progress', id] });
      const prev = qc.getQueryData<RoadmapProgress>(['roadmaps', 'progress', id]);
      if (prev) {
        const checked_set = checked
          ? [...prev.checked.filter((c) => c.stepId !== stepId), { stepId, createdAt: new Date().toISOString() }]
          : prev.checked.filter((c) => c.stepId !== stepId);
        const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
        const byDay = { ...prev.byDay };
        byDay[today] = Math.max((byDay[today] ?? 0) + (checked ? 1 : -1), 0);
        if (byDay[today] === 0) delete byDay[today];
        qc.setQueryData<RoadmapProgress>(['roadmaps', 'progress', id], () => ({
          ...prev,
          checked: checked_set,
          byDay,
          totalChecked: checked_set.length,
        }));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['roadmaps', 'progress', id], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['roadmaps', 'progress', id] });
    },
  });
}

export function useRoadmapProgress(id: string, enabled = true) {
  return useQuery({
    queryKey: ['roadmaps', 'progress', id],
    queryFn: () => apiFetch<RoadmapProgress>(`/roadmaps/${id}/progress`),
    enabled: !!id && enabled,
  });
}
