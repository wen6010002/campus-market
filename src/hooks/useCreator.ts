'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { CreatorSummary, WorkListItem, Dynamic } from '@/lib/types';

export function useCreator(id: string) {
  return useQuery({
    queryKey: ['creators', 'detail', id],
    queryFn: () => apiFetch<CreatorSummary>(`/creators/${id}`),
    enabled: !!id,
  });
}

export function useCreatorWorks(id: string, filter: string) {
  return useQuery({
    queryKey: ['creators', id, 'works', filter],
    queryFn: () => apiFetch<WorkListItem[]>(`/creators/${id}/works?filter=${filter}`),
    enabled: !!id,
  });
}

export function useFollowingFeed() {
  return useQuery({
    queryKey: ['following', 'feed'],
    queryFn: () => apiFetch<Dynamic[]>('/me/following/feed'),
  });
}
