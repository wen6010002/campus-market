import { z } from 'zod';

/** 发评论（V12）：content 与作品评价同宽；parentId 仅允许一级回复（service 层守卫深度） */
export const createCommentSchema = z.object({
  content: z.string().trim().min(1, '评论不能为空').max(600, '评论最多 600 字'),
  parentId: z.string().trim().min(1).max(32).optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
