'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { UserProfile, WorkListItem, Dynamic, FollowRow } from '@/lib/types';

/** 用户主页数据（V3-5：/creators/* 已迁移到 /users/*）。
 *  queryKey 含 viewerId：匿名期缓存的 isSelf=false 不会在登录后复用（服务端按 cookie 判定视角）；
 *  未登录时仍可查询（他人主页匿名可见）。 */
export function useUserProfile(id: string, viewerId?: string | null) {
  return useQuery({
    queryKey: ['users', 'detail', id, viewerId ?? 'anon'],
    queryFn: () => apiFetch<UserProfile>(`/users/${id}`),
    enabled: !!id,
  });
}

export function useUserWorks(id: string, filter: string) {
  return useQuery({
    queryKey: ['users', id, 'works', filter],
    queryFn: () => apiFetch<WorkListItem[]>(`/users/${id}/works?filter=${filter}`),
    enabled: !!id,
  });
}

export function useUserRatings(id: string) {
  return useQuery({
    queryKey: ['users', id, 'ratings'],
    queryFn: () =>
      apiFetch<
        {
          id: string;
          stars: number;
          text: string;
          createdAt: string;
          work: { id: string; title: string; course: string };
        }[]
      >(`/users/${id}/ratings`),
    enabled: !!id,
  });
}

export function useUserFollows(id: string, type: 'following' | 'followers') {
  return useQuery({
    queryKey: ['users', id, 'follows', type],
    queryFn: () => apiFetch<FollowRow[]>(`/users/${id}/follows?type=${type}`),
    enabled: !!id,
  });
}

export function useFollowingFeed(enabled = true) {
  return useQuery({
    queryKey: ['following', 'feed'],
    queryFn: () => apiFetch<Dynamic[]>('/me/following/feed'),
    enabled, // 首页等场景仅登录时请求，避免匿名 401
  });
}
