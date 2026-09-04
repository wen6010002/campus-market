import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { achievementService } from '@/server/services/achievement.service';

/** 解锁弹层：GET 取一条未展示的，POST 展示完毕确认（可带 body 续取下一条） */
export const GET = withErrorHandler(async () => {
  const s = await requireUser();
  return ok(await achievementService.popNext(s.userId));
});

export const POST = withErrorHandler(async (req: Request) => {
  const s = await requireUser();
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (body.id) await achievementService.confirmPop(body.id, s.userId);
  return ok(await achievementService.popNext(s.userId));
});
