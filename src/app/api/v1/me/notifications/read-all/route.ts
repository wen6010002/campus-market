import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { meService } from '@/server/services/me.service';

export const POST = withErrorHandler(async () => {
  const s = await requireUser();
  return ok(await meService.markAllRead(s.userId));
});
