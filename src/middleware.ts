import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE = process.env.JWT_COOKIE_NAME ?? 'cm_token';

// 粗粒度第一道防线：公开路由放行，其余无会话 cookie → 401。
// 细粒度 RBAC（ensurePublisher/requireAdmin）在 route handler 内做（有 DB 上下文）。
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  const isPublic =
    pathname.startsWith('/api/v1/auth/') ||
    pathname.startsWith('/api/v1/webhooks/') ||
    // V3-4：预览端点 POST 允许匿名（免费作品匿名可看 + 匿名 IP 计观看）
    /^\/api\/v1\/works\/[^/]+\/preview$/.test(pathname) ||
    (method === 'GET' &&
      (pathname.startsWith('/api/v1/works') ||
        pathname.startsWith('/api/v1/search') ||
        pathname.startsWith('/api/v1/ranks') ||
        pathname.startsWith('/api/v1/users')));

  if (isPublic) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: '请先登录' } },
      { status: 401 },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/v1/:path*'],
};
