import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { announceService } from '@/server/services/announce.service';

export const POST = withErrorHandler(async () => {
  const s = await requireUser();
  return ok(await announceService.markAllRead(s.userId));
});
