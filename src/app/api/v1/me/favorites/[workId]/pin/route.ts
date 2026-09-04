import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { socialService } from '@/server/services/social.service';

type Ctx = { params: { workId: string } };

/** V8 收藏置顶/取消置顶（收藏栏「以后再看」） */
export const POST = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const s = await requireUser();
  return ok(await socialService.favoritePin(s.userId, ctx.params.workId, true));
});

export const DELETE = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const s = await requireUser();
  return ok(await socialService.favoritePin(s.userId, ctx.params.workId, false));
});
