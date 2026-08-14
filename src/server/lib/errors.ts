// 统一错误码 + AppError —— 与 docs/API_CONTRACT.md §2 完全一致。
import { ZodError } from 'zod';

export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  NOT_EDU: 'NOT_EDU',
  CODE_INVALID: 'CODE_INVALID',
  CODE_EXPIRED: 'CODE_EXPIRED',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  INVALID_CREDENTIAL: 'INVALID_CREDENTIAL',
  ALREADY_CREATOR: 'ALREADY_CREATOR',
  NO_RATING_ACCESS: 'NO_RATING_ACCESS',
  ALREADY_RATED: 'ALREADY_RATED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  ORDER_CLOSED: 'ORDER_CLOSED',
  REFUND_NOT_ALLOWED: 'REFUND_NOT_ALLOWED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  COPYRIGHT_REQUIRED: 'COPYRIGHT_REQUIRED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_TYPE_DENIED: 'FILE_TYPE_DENIED',
  BAD_FILE: 'BAD_FILE',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const httpStatusByCode: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  NOT_EDU: 400,
  CODE_INVALID: 400,
  CODE_EXPIRED: 400,
  EMAIL_TAKEN: 409,
  USERNAME_TAKEN: 409,
  INVALID_CREDENTIAL: 401,
  ALREADY_CREATOR: 409,
  NO_RATING_ACCESS: 403,
  ALREADY_RATED: 409,
  PAYMENT_REQUIRED: 402,
  ORDER_CLOSED: 409,
  REFUND_NOT_ALLOWED: 402,
  INSUFFICIENT_BALANCE: 400,
  COPYRIGHT_REQUIRED: 400,
  FILE_TOO_LARGE: 413,
  FILE_TYPE_DENIED: 415,
  BAD_FILE: 400,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function appError(code: ErrorCode, message: string, details?: unknown): AppError {
  return new AppError(code, httpStatusByCode[code], message, details);
}

/** 从 Zod 校验错误转 AppError（VALIDATION，details 带字段） */
export function validationError(e: ZodError): AppError {
  return new AppError('VALIDATION', 400, '参数校验失败', {
    issues: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  });
}
