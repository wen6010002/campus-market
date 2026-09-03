import { z } from 'zod';
import { WorkStatus, Quality, FileType } from '../constants';

// 分页与排序（契约 §0.2）
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const paginationSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export const workSortEnum = z.enum(['complex', 'hot', 'rate', 'new', 'price']);
export const ratingSortEnum = z.enum(['new', 'helpful', 'high', 'low']);

export const enumValue = <T extends Record<string, string>>(obj: T) =>
  z.enum(Object.values(obj) as [string, ...string[]]);

export const roleSchema = z.enum(['STUDENT', 'CREATOR', 'ADMIN']);
export const workStatusSchema = z.nativeEnum(WorkStatus);
export const qualitySchema = z.nativeEnum(Quality);
export const fileTypeSchema = z.nativeEnum(FileType);
