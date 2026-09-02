import { withErrorHandler, ok } from '@/server/lib/http';
import { getSession } from '@/server/auth/session';
import { roadmapService } from '@/server/services/roadmap.service';

export const GET = withErrorHandler(async (_req: Request, ctx: { params: { id: string } }) => {
  const s = await getSession();
  return ok(await roadmapService.get(ctx.params.id, s?.userId, s?.role));
});
