import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { meService } from '@/server/services/me.service';

export const GET = withErrorHandler(async (req: Request) => {
  const s = await requireUser();
  const filter = new URL(req.url).searchParams.get('filter') ?? 'all';
  return ok(await meService.library(s.userId, filter));
});
