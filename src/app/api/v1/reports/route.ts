import { z } from 'zod';
import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { reportService } from '@/server/services/report.service';
import { ReportTargetType, ReportReason } from '@/lib/constants';

const reportSchema = z.object({
  targetType: z.nativeEnum(ReportTargetType),
  targetId: z.string().min(1),
  reason: z.nativeEnum(ReportReason),
  detail: z.string().max(600).optional(),
});

export const POST = withErrorHandler(async (req: Request) => {
  const s = await requireUser();
  const input = reportSchema.parse(await readJson(req));
  const report = await reportService.create(s.userId, input);
  return ok(report, { status: 201 });
});
