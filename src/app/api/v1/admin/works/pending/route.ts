import { withErrorHandler, ok } from '@/server/lib/http';
import { workService } from '@/server/services/work.service';
import { requireAdmin } from '@/server/auth/session';

export const GET = withErrorHandler(async () => {
  await requireAdmin();
  const works = await workService.adminPending();
  return ok(works);
});
