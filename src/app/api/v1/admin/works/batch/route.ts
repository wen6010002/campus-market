import { withErrorHandler, ok, readJson } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { adminService } from '@/server/services/admin.service';
import { z } from 'zod';

const batchSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(200),
  action: z.enum(['publish', 'takeDown', 'setFine', 'setFree', 'delete']),
});

/** 资料管理：批量上线/下架/调分区/删除 */
export const POST = withErrorHandler(async (req: Request) => {
  const s = await requireAdmin();
  const { ids, action } = batchSchema.parse(await readJson(req));
  return ok(await adminService.batchWorks(s.userId, ids, action));
});
