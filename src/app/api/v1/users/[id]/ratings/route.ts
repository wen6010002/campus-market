import { withErrorHandler, ok } from '@/server/lib/http';
import { socialService } from '@/server/services/social.service';

type Ctx = { params: { id: string } };

/** 用户公开评价历史（V3-5） */
export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  return ok(await socialService.userRatings(ctx.params.id));
});
