import { withErrorHandler, ok } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { roadmapService } from '@/server/services/roadmap.service';

export const GET = withErrorHandler(async (_req: Request, ctx: { params: { id: string } }) => {
  await requireAdmin();
  return ok(await roadmapService.adminGet(ctx.params.id));
});
