import { withErrorHandler, ok } from '@/server/lib/http';
import { getSession } from '@/server/auth/session';
import { socialService } from '@/server/services/social.service';

type Ctx = { params: { id: string } };

/** 用户主页数据（V3-5，公开；带会话回填 myFollow/isSelf） */
export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const session = await getSession();
  return ok(await socialService.userDetail(ctx.params.id, session?.userId));
});
