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

/** 路由薄层统一错误处理：AppError / ZodError / 兜底 500 */
export function withErrorHandler<C = unknown>(
  handler: (req: Request, ctx: C) => Promise<NextResponse>,
) {
  return async (req: Request, ctx: C): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ZodError) return errorResponse(validationError(e));
      if (e instanceof AppError) return errorResponse(e);
      logger.error({ err: e }, 'unhandled route error');
      return errorResponse(new AppError('INTERNAL', 500, '服务端错误'));
    }
  };
}
