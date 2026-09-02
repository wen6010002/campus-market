import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { roadmapService } from '@/server/services/roadmap.service';

export const GET = withErrorHandler(async (_req: Request, ctx: { params: { id: string } }) => {
  const s = await requireUser();
  return ok(await roadmapService.progress(s.userId, ctx.params.id));
});
