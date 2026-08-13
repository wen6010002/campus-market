'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { Rating } from '@/lib/types';

export function useRatings(workId: string, sort: string) {
  return useQuery({
    queryKey: ['works', workId, 'ratings', sort],
    queryFn: () => apiFetch<Rating[]>(`/works/${workId}/ratings?sort=${sort}`),
    enabled: !!workId,
  });
}

export function useRatingTags(workId: string) {
  return useQuery({
    queryKey: ['rating-tags', workId],
    queryFn: () => apiFetch<{ pos: string[]; neg: string[] }>(`/works/${workId}/ratings/tags`),
    enabled: !!workId,
  });
}

export function useCreateRating(workId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { stars: number; text: string; tags: string[] }) =>
      apiFetch(`/works/${workId}/ratings`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['works', 'detail', workId] });
      qc.invalidateQueries({ queryKey: ['works', workId, 'ratings'] });
      qc.invalidateQueries({ queryKey: ['me', 'ratings'] });
    },
  });
}
