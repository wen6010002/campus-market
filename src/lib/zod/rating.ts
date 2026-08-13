import { z } from 'zod';

export const createRatingSchema = z.object({
  stars: z.number().int().min(1).max(5),
  text: z.string().trim().min(5, '评价至少 5 个字').max(600),
  tags: z.array(z.string().trim().min(1).max(20)).max(5).default([]),
});

export const ratingReplySchema = z.object({
  text: z.string().trim().min(1).max(600),
});

export type CreateRatingInput = z.infer<typeof createRatingSchema>;
