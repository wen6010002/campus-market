import { withErrorHandler, ok } from '@/server/lib/http';
import { ratingService } from '@/server/services/rating.service';
import { requireUser } from '@/server/auth/session';

type Ctx = { params: { rid: string } };

export const POST = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const s = await requireUser();
  const result = await ratingService.helpful(ctx.params.rid, s.userId);
  return ok(result);
});
