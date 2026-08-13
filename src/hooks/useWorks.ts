'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetchPage } from '@/lib/api/client';
import type { WorkListItem } from '@/lib/types';

export interface WorkListParams {
  page?: number;
  pageSize?: number;
  sort?: 'complex' | 'hot' | 'rate' | 'new' | 'price';
  isFree?: boolean;
  quality?: string;
  fileType?: string;
  minRating?: number;
  course?: string;
  tag?: string;
  creatorId?: string;
}

function toQuery(params: WorkListParams): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  return qs.toString();
}

export function useWorks(params: WorkListParams) {
  return useQuery({
    queryKey: ['works', 'list', params],
    queryFn: () => apiFetchPage<WorkListItem[]>(`/works?${toQuery(params)}`),
  });
}
