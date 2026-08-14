import { z } from 'zod';
import { FileType, Quality } from '../constants';

// 金额字符串："9.90"
const money = z.string().regex(/^\d+(\.\d{1,2})?$/, '金额格式错误');

export const workInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(800),
  course: z.string().trim().min(1).max(100),
  fileType: z.nativeEnum(FileType),
  fileKey: z.string().trim().min(1),
  fileSha: z.string().max(64).optional(),
  fileSize: z.number().int().min(0).max(209715200),
  pages: z.number().int().min(0).max(100000).optional(),
  coverIcon: z.string().max(8).optional(),
  coverTheme: z.string().max(32).optional(),
  isFree: z.boolean().default(true),
  price: money.optional(),
  oldPrice: money.optional(),
  applyMajor: z.string().max(100).nullable().optional(),
  applyGrade: z.string().max(100).nullable().optional(),
  applyCrowd: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(20)).max(5).default([]),
  previewToc: z.array(z.string().max(200)).max(50).default([]),
  isOriginal: z.boolean().default(true),
  copyrightAccepted: z.boolean().default(false),
});

export const workQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  creatorId: z.string().optional(),
  isFree: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  quality: z.nativeEnum(Quality).optional(),
  fileType: z.nativeEnum(FileType).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  updatedSince: z.string().optional(),
  course: z.string().optional(),
  tag: z.string().optional(),
  sort: z.enum(['complex', 'hot', 'rate', 'new', 'price']).default('complex'),
});

export type WorkInput = z.infer<typeof workInputSchema>;
export type WorkQuery = z.infer<typeof workQuerySchema>;
