import { z } from 'zod';
import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { adminService } from '@/server/services/admin.service';

type Ctx = { params: { id: string } };

const banSchema = z.object({ reason: z.string().max(200).optional() });

export const POST = withErrorHandler(async (req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { reason } = banSchema.parse(await readJson(req));
  const user = await adminService.banUser(ctx.params.id, reason);
  return ok({ id: user.id, status: user.status });
});
