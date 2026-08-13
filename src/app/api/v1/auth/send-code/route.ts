import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { authService } from '@/server/services/auth.service';
import { sendCodeSchema } from '@/lib/zod/auth';

export const POST = withErrorHandler(async (req: Request) => {
  const { email } = sendCodeSchema.parse(await readJson(req));
  await authService.sendCode(email);
  return ok({ ok: true });
});
