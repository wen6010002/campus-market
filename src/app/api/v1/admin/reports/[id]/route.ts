import { z } from 'zod';
import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { reportService } from '@/server/services/report.service';
import { ReportStatus } from '@/lib/constants';

type Ctx = { params: { id: string } };

const handleSchema = z.object({
  status: z.nativeEnum(ReportStatus),
  note: z.string().max(600).optional(),
});

export const POST = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { status, note } = handleSchema.parse(await readJson(req));
  const report = await reportService.adminHandle(ctx.params.id, status, note, admin.userId);
  return ok(report);
});
