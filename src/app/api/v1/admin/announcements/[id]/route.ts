import { withErrorHandler, ok } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { announceService } from '@/server/services/announce.service';

export const DELETE = withErrorHandler(async (_req: Request, ctx: { params: { id: string } }) => {
  await requireAdmin();
  return ok(await announceService.unpublish(ctx.params.id));
});
