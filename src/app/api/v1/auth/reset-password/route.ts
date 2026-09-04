import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { authService } from '@/server/services/auth.service';
import { resetPasswordSchema } from '@/lib/zod/auth';

export const POST = withErrorHandler(async (req: Request) => {
  const input = resetPasswordSchema.parse(await readJson(req));
  return ok(await authService.resetPassword(input));
});
