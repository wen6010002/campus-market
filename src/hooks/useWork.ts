'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { WorkDetail } from '@/lib/types';

export function useWork(id: string) {
  return useQuery({
    queryKey: ['works', 'detail', id],
    queryFn: () => apiFetch<WorkDetail>(`/works/${id}`),
    enabled: !!id,
  });
}
