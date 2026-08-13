'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

/** 收藏切换（乐观更新 work 详情 + 失效列表/我的收藏） */
export function useFavorite(workId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fav: boolean) =>
      apiFetch(`/works/${workId}/favorite`, fav ? { method: 'POST' } : { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['works', 'detail', workId] });
      qc.invalidateQueries({ queryKey: ['me', 'favorites'] });
    },
  });
}

/** 点赞切换 */
export function useLike(workId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (liked: boolean) =>
      apiFetch(`/works/${workId}/like`, liked ? { method: 'POST' } : { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['works', 'detail', workId] }),
  });
}

/** 关注切换（失效创作者详情 + 关注流） */
export function useFollow(creatorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (followed: boolean) =>
      apiFetch(
        `/creators/${creatorId}/follow`,
        followed ? { method: 'POST' } : { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['creators', 'detail', creatorId] });
      qc.invalidateQueries({ queryKey: ['following', 'feed'] });
    },
  });
}
