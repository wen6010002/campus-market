import { randomUUID } from 'node:crypto';
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

/** CSRF：非 GET/HEAD 的写操作校验 Origin/Referer 与请求自身 Host 同源（webhook 走验签，不经此函数）。
 *  与请求 Host（含端口）比对而非固定 APP_BASE_URL——本地 localhost/127.0.0.1/局域网 IP/生产域名一律正确判定；
 *  Host 由浏览器按目标服务器设定，跨站攻击者无法令受害浏览器伪造（Django 同款做法）。 */
export function assertSameOrigin(req: Request): void {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  // 无 Origin 也无 Referer（curl/服务端调用）放行；浏览器请求必须带且同源
  if (!origin && !referer) return;
  const source = origin ?? referer ?? '';
  let src: URL;
  try {
    src = new URL(source);
  } catch {
    throw new AppError('FORBIDDEN', httpStatusByCode.FORBIDDEN, '跨源请求被拒绝');
  }
  // Host 判定优先级：反代 x-forwarded-host → 请求 host 头 → 请求 URL（单测/直连场景兜底）
  const host =
    req.headers.get('x-forwarded-host')?.split(',')[0].trim() ??
    req.headers.get('host') ??
    safeUrlHost(req.url);
  if (!host || src.host !== host) {
    throw new AppError('FORBIDDEN', httpStatusByCode.FORBIDDEN, '跨源请求被拒绝');
  }
}

function safeUrlHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** 路由薄层统一错误处理：AppError / ZodError / 兜底 500；写操作先过 CSRF 校验 + 访问日志 */
export function withErrorHandler<C = unknown>(
  handler: (req: Request, ctx: C) => Promise<NextResponse>,
) {
  return async (req: Request, ctx: C): Promise<NextResponse> => {
    const start = Date.now();
    const requestId = req.headers.get('x-request-id') ?? randomUUID();
    const path = new URL(req.url).pathname;
    try {
      assertSameOrigin(req);
      const res = await handler(req, ctx);
      logger.info(
        { requestId, method: req.method, path, status: res.status, duration: Date.now() - start },
        'http',
      );
      res.headers.set('x-request-id', requestId);
      return res;
    } catch (e) {
      if (e instanceof ZodError) {
        const res = errorResponse(validationError(e));
        res.headers.set('x-request-id', requestId);
        return res;
      }
      if (e instanceof AppError) {
        const res = errorResponse(e);
        res.headers.set('x-request-id', requestId);
        return res;
      }
      logger.error({ requestId, err: e, path }, 'unhandled route error');
      const res = errorResponse(new AppError('INTERNAL', 500, '服务端错误'));
      res.headers.set('x-request-id', requestId);
      return res;
    }
  };
}
