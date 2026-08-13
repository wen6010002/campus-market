import { withErrorHandler, ok } from '@/server/lib/http';
import { socialService } from '@/server/services/social.service';

type Ctx = { params: { id: string } };

export const GET = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const filter = new URL(req.url).searchParams.get('filter') ?? undefined;
  const works = await socialService.creatorWorks(ctx.params.id, filter);
  return ok(works);
});
