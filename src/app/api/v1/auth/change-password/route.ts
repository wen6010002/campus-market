import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { authService } from '@/server/services/auth.service';
import { changePasswordSchema } from '@/lib/zod/auth';

export const POST = withErrorHandler(async (req: Request) => {
  const s = await requireUser();
  const input = changePasswordSchema.parse(await readJson(req));
  return ok(await authService.changePassword(s.userId, input));
});
