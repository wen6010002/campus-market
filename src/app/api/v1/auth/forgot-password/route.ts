import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { authService } from '@/server/services/auth.service';
import { forgotPasswordSchema } from '@/lib/zod/auth';

export const POST = withErrorHandler(async (req: Request) => {
  const { email } = forgotPasswordSchema.parse(await readJson(req));
  return ok(await authService.forgotPassword(email));
});
