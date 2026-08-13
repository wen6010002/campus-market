import { withErrorHandler, ok } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { reportService } from '@/server/services/report.service';

export const GET = withErrorHandler(async () => {
  await requireAdmin();
  return ok(await reportService.adminList());
});
