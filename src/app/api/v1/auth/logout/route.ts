import { withErrorHandler, ok } from '@/server/lib/http';
import { SESSION_COOKIE, sessionCookieOptions } from '@/server/auth/session';

export const POST = withErrorHandler(async () => {
  const res = ok({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
  return res;
});
