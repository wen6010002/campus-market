'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchPage } from '@/lib/api/client';
import type { Comment } from '@/lib/types';

export type CommentTargetType = 'WORK' | 'ROADMAP';

function basePath(targetType: CommentTargetType, targetId: string) {
  return targetType === 'WORK' ? `/works/${targetId}/comments` : `/roadmaps/${targetId}/comments`;
}

/** 评论列表：按页拉取，合并 1..page 全部缓存页（翻页只请求新页，旧页来自缓存） */
export function useComments(targetType: CommentTargetType, targetId: string) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['comments', targetType, targetId, page],
    queryFn: () =>
      apiFetchPage<Comment[]>(`${basePath(targetType, targetId)}?page=${page}&pageSize=20`),
    enabled: !!targetId,
  });

  const merged: Comment[] = [];
  const seen = new Set<string>();
  for (let p = 1; p <= page; p++) {
    const d = qc.getQueryData<{ data: Comment[] }>(['comments', targetType, targetId, p])?.data;
    if (d)
      for (const c of d)
        if (!seen.has(c.id)) {
          seen.add(c.id);
          merged.push(c);
        }
  }

  return {
    isLoading: query.isLoading && page === 1,
    isFetchingMore: query.isFetching && page > 1,
    data: merged,
    total: query.data?.pagination.total ?? 0,
    hasMore: query.data ? page < query.data.pagination.totalPages : false,
    loadMore: () => setPage((p) => p + 1),
  };
}

export function useCreateComment(targetType: CommentTargetType, targetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { content: string; parentId?: string }) =>
      apiFetch<{ id: string; status: 'VISIBLE' | 'PENDING_REVIEW' }>(
        basePath(targetType, targetId),
        { method: 'POST', body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', targetType, targetId] });
    },
  });
}

export function useDeleteComment(targetType: CommentTargetType, targetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => apiFetch(`/comments/${commentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', targetType, targetId] });
    },
  });
}
