'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { WorkListItem, CreatorSummary } from '@/lib/types';

export interface SearchResult {
  works: WorkListItem[];
  creators: CreatorSummary[];
  total: number;
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => apiFetch<SearchResult>(`/search?q=${encodeURIComponent(q)}`),
    enabled: !!q.trim(),
  });
}

export function useRank(type: string) {
  return useQuery({
    queryKey: ['ranks', type],
    queryFn: () => apiFetch<any[]>(`/ranks/${type}`),
  });
}
