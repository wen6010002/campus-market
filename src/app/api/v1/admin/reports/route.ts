import { withErrorHandler, ok } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { reportService } from '@/server/services/report.service';

/** 举报队列（ADMIN，按 target 聚合：人数/举报人/原因分布/快照；?status= 过滤） */
export const GET = withErrorHandler(async (req: Request) => {
  await requireAdmin();
  const status = new URL(req.url).searchParams.get('status') ?? undefined;
  return ok(await reportService.adminList(status));
});
