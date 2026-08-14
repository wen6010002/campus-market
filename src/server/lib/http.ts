import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, validationError, httpStatusByCode } from './errors';
import { logger } from './logger';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function okPage<T>(
  data: T,
  pagination: { page: number; pageSize: number; total: number; totalPages: number },
) {
  return NextResponse.json({ data, pagination });
}

export function errorResponse(e: AppError): NextResponse {
  const res = NextResponse.json(
    { error: { code: e.code, message: e.message, details: e.details } },
    { status: e.status },
  );
  const retryAfter = (e.details as { retryAfter?: number } | undefined)?.retryAfter;
  if (e.code === 'RATE_LIMITED' && retryAfter) {
    res.headers.set('Retry-After', String(retryAfter));
  }
  return res;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError('VALIDATION', httpStatusByCode.VALIDATION, '请求体需为 JSON');
  }
}

/** CSRF：非 GET/HEAD 的写操作校验 Origin/Referer 同源（webhook 走验签，不经此函数） */
export function assertSameOrigin(req: Request): void {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  // 无 Origin 也无 Referer（curl/服务端调用）放行；浏览器请求必须带且同源
  if (!origin && !referer) return;
  const base = process.env.APP_BASE_URL ?? 'http://localhost:3000';
  const source = origin ?? referer ?? '';
  if (!source.startsWith(base)) {
    throw new AppError('FORBIDDEN', httpStatusByCode.FORBIDDEN, '跨源请求被拒绝');
  }
}

/** 路由薄层统一错误处理：AppError / ZodError / 兜底 500；写操作先过 CSRF 校验 */
export function withErrorHandler<C = unknown>(
  handler: (req: Request, ctx: C) => Promise<NextResponse>,
) {
  return async (req: Request, ctx: C): Promise<NextResponse> => {
    try {
      assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ZodError) return errorResponse(validationError(e));
      if (e instanceof AppError) return errorResponse(e);
      logger.error({ err: e }, 'unhandled route error');
      return errorResponse(new AppError('INTERNAL', 500, '服务端错误'));
    }
  };
}
