import { z } from 'zod';
import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { requireAdmin } from '@/server/auth/session';
import { adminService } from '@/server/services/admin.service';

type Ctx = { params: { id: string } };

const roleSchema = z.object({ role: z.enum(['STUDENT', 'CREATOR', 'ADMIN']) });

export const POST = withErrorHandler(async (req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { role } = roleSchema.parse(await readJson(req));
  const user = await adminService.setRole(ctx.params.id, role);
  return ok({ id: user.id, role: user.role });
});
