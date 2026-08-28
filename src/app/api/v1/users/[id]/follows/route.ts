import { withErrorHandler, ok } from '@/server/lib/http';
import { getSession } from '@/server/auth/session';
import { socialService } from '@/server/services/social.service';

type Ctx = { params: { id: string } };

/** 关注/粉丝列表（V3-5，公开；?type=following|followers&page=） */
export const GET = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const session = await getSession();
  const sp = new URL(req.url).searchParams;
  const type = sp.get('type') === 'followers' ? 'followers' : 'following';
  const page = Math.max(1, Number(sp.get('page') ?? 1) || 1);
  return ok(await socialService.userFollows(ctx.params.id, type, page, session?.userId));
});
