import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { reportService } from '@/server/services/report.service';

/** 我的举报（V3-6）：状态与处理备注 */
export const GET = withErrorHandler(async () => {
  const s = await requireUser();
  return ok(await reportService.myReports(s.userId));
});
