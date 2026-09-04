'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

export interface HonorItem {
  key: string;
  emoji: string;
  title: string;
  rarity: string;
  symbol: string;
  description: string | null;
  got: boolean;
  active: boolean;
  pinned: boolean;
  earnedAt: string | null;
  expiresAt: string | null;
}

export interface MyHonor {
  items: HonorItem[];
  pinnedCount: number;
  progresses: { helped: number; likes: number; favs: number; works: number };
}

/** 本人荣誉墙（含进度值） */
export function useMyHonor(enabled = true) {
  return useQuery({
    queryKey: ['me', 'achievements'],
    queryFn: () => apiFetch<MyHonor>('/me/achievements'),
    enabled,
    staleTime: 30_000,
  });
}

/** 他人荣誉墙（公开只读） */
export function useHonorPublic(userId: string) {
  return useQuery({
    queryKey: ['users', userId, 'achievements'],
    queryFn: () => apiFetch<{ items: HonorItem[] }>(`/users/${userId}/achievements`),
    staleTime: 60_000,
  });
}

/** 佩戴/卸下勋章 */
export function usePinAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, on }: { key: string; on: boolean }) =>
      apiFetch(`/me/achievements/${key}/pin`, on ? { method: 'POST' } : { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'achievements'] });
      qc.invalidateQueries({ queryKey: ['users', 'detail'] });
    },
  });
}

export interface PopAchievement {
  id: string;
  key: string;
  title: string;
  rarity: string;
  symbol: string;
  description: string | null;
}

/** 解锁弹层：取一条待展示的，确认后取下一条（组件内 POST 轮转） */
export function useAchievementPop(enabled: boolean) {
  return useQuery({
    queryKey: ['me', 'achievement-pop'],
    queryFn: () => apiFetch<PopAchievement | null>('/me/achievement-pop'),
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
}
