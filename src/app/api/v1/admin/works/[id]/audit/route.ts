import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { workService } from '@/server/services/work.service';
import { requireAdmin } from '@/server/auth/session';
import { z } from 'zod';

type Ctx = { params: { id: string } };

const auditSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'TAKE_DOWN', 'REQUEST_CHANGES']),
  note: z.string().max(600).optional(),
});

export const POST = withErrorHandler(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { action, note } = auditSchema.parse(await readJson(req));
  const work = await workService.adminAudit(ctx.params.id, action, note, admin.userId);
  return ok(work);
});
