import { z } from 'zod';
import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { adminService } from '@/server/services/admin.service';

type Ctx = { params: { id: string } };

const auditSchema = z.object({ approve: z.boolean() });

export const POST = withErrorHandler(async (req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { approve } = auditSchema.parse(await readJson(req));
  const creator = await adminService.auditCreator(ctx.params.id, approve);
  return ok({ id: creator.id, verified: creator.verified });
});
