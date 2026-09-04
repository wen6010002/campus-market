import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { roadmapService } from '@/server/services/roadmap.service';

export const POST = withErrorHandler(async (_req: Request, ctx: { params: { id: string } }) => {
  const s = await requireUser();
  return ok(await roadmapService.setFavorite(s.userId, ctx.params.id, true));
});

export const DELETE = withErrorHandler(async (_req: Request, ctx: { params: { id: string } }) => {
  const s = await requireUser();
  return ok(await roadmapService.setFavorite(s.userId, ctx.params.id, false));
});
