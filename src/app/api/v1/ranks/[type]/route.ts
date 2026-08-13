import { withErrorHandler, ok } from '@/server/lib/http';
import { rankService } from '@/server/services/rank.service';

type Ctx = { params: { type: string } };

export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const ranks = await rankService.ranks(ctx.params.type);
  return ok(ranks);
});
