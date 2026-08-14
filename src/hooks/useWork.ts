'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { WorkDetail } from '@/lib/types';

/** initialWork 由服务端组件预取注入，避免「加载中」闪烁（SSR 直出） */
export function useWork(id: string, initialWork?: WorkDetail | null) {
  return useQuery({
    queryKey: ['works', 'detail', id],
    queryFn: () => apiFetch<WorkDetail>(`/works/${id}`),
    enabled: !!id,
    ...(initialWork ? { initialData: initialWork } : {}),
  });
}
