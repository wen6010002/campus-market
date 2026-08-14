import { withErrorHandler, ok } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { adminService } from '@/server/services/admin.service';

type Ctx = { params: { id: string } };

export const POST = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  await requireAdmin();
  const user = await adminService.unbanUser(ctx.params.id);
  return ok({ id: user.id, status: user.status });
});
