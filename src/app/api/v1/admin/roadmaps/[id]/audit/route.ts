import { z } from 'zod';
import { withErrorHandler, ok, readJson } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { roadmapService } from '@/server/services/roadmap.service';

const auditSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  note: z.string().max(600).optional(),
});

export const POST = withErrorHandler(async (req: Request, ctx: { params: { id: string } }) => {
  const s = await requireAdmin();
  const { action, note } = auditSchema.parse(await readJson(req));
  return ok(await roadmapService.adminAudit(ctx.params.id, action, note, s.userId));
});
