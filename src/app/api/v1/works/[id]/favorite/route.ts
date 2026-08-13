import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { socialService } from '@/server/services/social.service';

type Ctx = { params: { id: string } };

export const POST = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const s = await requireUser();
  return ok(await socialService.favorite(s.userId, ctx.params.id));
});

export const DELETE = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const s = await requireUser();
  return ok(await socialService.unfavorite(s.userId, ctx.params.id));
});
