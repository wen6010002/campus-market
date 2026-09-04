import { z } from 'zod';
import { AnnounceLevel } from '../constants';

export const announceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export const announceInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(5000),
  level: z.nativeEnum(AnnounceLevel).default('NORMAL'),
});

export type AnnounceQuery = z.infer<typeof announceQuerySchema>;
export type AnnounceInput = z.infer<typeof announceInputSchema>;
