import { z } from 'zod';
import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { reportService } from '@/server/services/report.service';
import { ReportTargetType } from '@/lib/constants';

const handleSchema = z.object({
  targetType: z.nativeEnum(ReportTargetType),
  targetId: z.string().min(1),
  action: z.enum(['RESOLVE', 'DISMISS']),
  note: z.string().max(600).optional(),
  measures: z
    .object({
      takedownWork: z.boolean().optional(),
      deleteComment: z.boolean().optional(),
      banUser: z.boolean().optional(),
      banReason: z.string().max(200).optional(),
    })
    .optional(),
});

/** 处置（V3-6）：按 target 批量关单 + 措施联动（下架/删评/封号）+ 双向通知 */
export const POST = withErrorHandler(async (req: Request) => {
  const admin = await requireAdmin();
  const input = handleSchema.parse(await readJson(req));
  return ok(await reportService.adminHandle(input, admin.userId));
});
