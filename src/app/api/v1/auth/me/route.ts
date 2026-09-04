import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { buildAuthUserCached } from '@/server/services/auth.service';

export const GET = withErrorHandler(async () => {
  const s = await requireUser();
  return ok(await buildAuthUserCached(s.userId));
});
