import { ok, withErrorHandler } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { opsService } from '@/server/services/ops.service';

export const GET = withErrorHandler(async () => {
  await requireAdmin();
  return ok(await opsService.overview());
});
