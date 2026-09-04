import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { achievementService } from '@/server/services/achievement.service';

type Ctx = { params: { key: string } };

/** 设/取消「展示成就」（唯一一枚，inline 展示位挂它；取消回落佩戴第一枚） */
export const POST = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const s = await requireUser();
  return ok(await achievementService.setFeatured(s.userId, ctx.params.key as any, true));
});

export const DELETE = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const s = await requireUser();
  return ok(await achievementService.setFeatured(s.userId, ctx.params.key as any, false));
});
