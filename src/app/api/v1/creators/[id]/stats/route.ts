import { withErrorHandler, ok } from '@/server/lib/http';
import { socialService } from '@/server/services/social.service';

type Ctx = { params: { id: string } };

export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  return ok(await socialService.creatorStats(ctx.params.id));
});
