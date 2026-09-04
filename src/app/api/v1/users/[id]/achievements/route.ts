import { withErrorHandler, ok } from '@/server/lib/http';
import { getSession } from '@/server/auth/session';
import { achievementService } from '@/server/services/achievement.service';

type Ctx = { params: { id: string } };

/** 他人主页荣誉墙（公开，只读；不含佩戴管理） */
export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  await getSession(); // 公开可看
  const { items } = await achievementService.listHonor(ctx.params.id);
  return ok({ items });
});
