import { withErrorHandler, readJson, ok } from '@/server/lib/http';
import { authService, buildAuthUser } from '@/server/services/auth.service';
import { signSession, SESSION_COOKIE, sessionCookieOptions } from '@/server/auth/session';
import { registerSchema } from '@/lib/zod/auth';

export const POST = withErrorHandler(async (req: Request) => {
  const input = registerSchema.parse(await readJson(req));
  const { userId, role, creatorProfileId } = await authService.register(input);
  const token = await signSession({ userId, role, creatorProfileId });
  const res = ok(await buildAuthUser(userId), { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
});
