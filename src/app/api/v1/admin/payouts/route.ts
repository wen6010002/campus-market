import { withErrorHandler, ok } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { adminService } from '@/server/services/admin.service';

export const GET = withErrorHandler(async () => {
  await requireAdmin();
  return ok(await adminService.listPayouts());
});
