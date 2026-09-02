import { withErrorHandler } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { adminService } from '@/server/services/admin.service';
import { ok } from '@/server/lib/http';

export const GET = withErrorHandler(async (_req: Request, ctx: { params: { id: string } }) => {
  await requireAdmin();
  return ok(await adminService.getUserDetail(ctx.params.id));
});
