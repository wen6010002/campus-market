import { withErrorHandler, ok } from '@/server/lib/http';
import { socialService } from '@/server/services/social.service';

type Ctx = { params: { id: string } };

/** 用户作品（V3-5，公开；filter=free|fine|hot） */
export const GET = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const filter = new URL(req.url).searchParams.get('filter') ?? undefined;
  return ok(await socialService.creatorWorks(ctx.params.id, filter));
});
