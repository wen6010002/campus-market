import { withErrorHandler, ok, readJson } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { adminService } from '@/server/services/admin.service';
import { z } from 'zod';

type Ctx = { params: { id: string } };

const patchSchema = z.object({
  isFree: z.boolean().optional(),
  category: z.string().trim().min(1).max(20).optional(),
  status: z.enum(['PUBLISHED', 'TAKEN_DOWN']).optional(),
});

/** 资料管理：调整分区（精品/普通）/分类/上下架 */
export const PATCH = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const s = await requireAdmin();
  return ok(
    await adminService.updateWork(s.userId, ctx.params.id, patchSchema.parse(await readJson(req))),
  );
});
