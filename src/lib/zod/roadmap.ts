import { z } from 'zod';
import { RoadmapCategory } from '../constants';

export const roadmapQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  category: z.nativeEnum(RoadmapCategory).optional(),
  sort: z.enum(['favs', 'newest']).default('favs'),
});

export const roadmapInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(500),
  category: z.nativeEnum(RoadmapCategory).default('OTHER'),
  coverIcon: z.string().max(8).optional(),
  coverTheme: z.string().max(32).optional(),
  mdSourceKey: z.string().trim().min(1).max(200),
  workIds: z.array(z.string().trim().min(1)).max(10).default([]),
  // 普通用户上传必填（服务端校验）；ADMIN 免
  credentialKey: z.string().trim().max(200).optional(),
  experience: z.string().trim().max(500).optional(),
});

export const roadmapCheckSchema = z.object({
  stepId: z.string().trim().min(3).max(20),
  checked: z.boolean(),
});

export type RoadmapQuery = z.infer<typeof roadmapQuerySchema>;
export type RoadmapInput = z.infer<typeof roadmapInputSchema>;
