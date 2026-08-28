'use client';

import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { FileType, CategoryKey } from '@/lib/constants';

export interface WorkCreateInput {
  title: string;
  description: string;
  course: string;
  fileType: FileType;
  fileKey: string;
  fileSha?: string;
  fileSize: number;
  pages?: number;
  coverIcon?: string;
  coverTheme?: string;
  coverKey?: string;
  previewKey?: string;
  category?: CategoryKey;
  isFree: boolean;
  isOriginal?: boolean;
  price?: string;
  oldPrice?: string;
  tags: string[];
  previewToc: string[];
  copyrightAccepted: boolean;
}

export function usePresign() {
  return useMutation({
    mutationFn: (input: {
      kind?: 'work' | 'cover' | 'avatar' | 'preview';
      fileType: FileType;
      fileSize: number;
      sha?: string;
    }) =>
      apiFetch<{ fileKey: string; putUrl: string }>('/uploads/presign', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function useCreateWork() {
  return useMutation({
    mutationFn: (input: WorkCreateInput) =>
      apiFetch<{ id: string }>('/works', { method: 'POST', body: JSON.stringify(input) }),
  });
}

export function usePublishWork() {
  return useMutation({
    mutationFn: (workId: string) => apiFetch(`/works/${workId}/publish`, { method: 'POST' }),
  });
}
