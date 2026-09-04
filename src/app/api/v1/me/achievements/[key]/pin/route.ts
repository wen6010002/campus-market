import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { achievementService } from '@/server/services/achievement.service';

type Ctx = { params: { key: string } };

/** 佩戴/卸下勋章（≤5；限时过期不可佩戴） */
export const POST = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const s = await requireUser();
  return ok(await achievementService.pin(s.userId, ctx.params.key as any, true));
});

export const DELETE = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const s = await requireUser();
  return ok(await achievementService.pin(s.userId, ctx.params.key as any, false));
});
