import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { buildAuthUser } from '@/server/services/auth.service';

export const GET = withErrorHandler(async () => {
  const s = await requireUser();
  return ok(await buildAuthUser(s.userId));
});
