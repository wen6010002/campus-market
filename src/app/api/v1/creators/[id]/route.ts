import { withErrorHandler, ok } from '@/server/lib/http';
import { getSession } from '@/server/auth/session';
import { socialService } from '@/server/services/social.service';

type Ctx = { params: { id: string } };

export const GET = withErrorHandler(async (_req: Request, ctx: Ctx) => {
  const session = await getSession();
  const detail = await socialService.creatorDetail(ctx.params.id, session?.userId);
  return ok(detail);
});
