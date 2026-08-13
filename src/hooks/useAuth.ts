'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api/client';
import type { AuthUser } from '@/lib/types';

/**
 * 当前登录态。401 视为「未登录」返回 null，不抛错。
 * F1 阶段配合登录/注册页与路由守卫使用；`refetchMe` 供登录后刷新。
 */
export function useAuth() {
  const q = useQuery({
    queryKey: ['me'],
    queryFn: async (): Promise<AuthUser | null> => {
      try {
        return await apiFetch<AuthUser>('/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
  });

  return { user: q.data ?? null, isLoading: q.isLoading, refetch: q.refetch };
}

export function useInvalidateMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['me'] });
}
