import { randomInt } from 'node:crypto';
import { redis } from '../lib/redis';
import { appError } from '../lib/errors';

// 深大 edu 邮箱验证码：Redis 存 6 位码，TTL 10 分钟。
// purpose 隔离注册码与重置码，防跨流程混用（V5）。
const TTL_MIN = Number(process.env.VERIFY_CODE_TTL_MIN ?? 10);
const CODE_LEN = Number(process.env.VERIFY_CODE_LEN ?? 6);

export type CodePurpose = 'register' | 'reset';

export const EDU_EMAIL_REGEX = new RegExp(
  process.env.EDU_EMAIL_REGEX ?? '^[^@]+@([a-zA-Z0-9-]+\\.)*szu\\.edu\\.cn$',
);

export function isEduEmail(email: string): boolean {
  return EDU_EMAIL_REGEX.test(email.trim());
}

function key(purpose: CodePurpose, email: string): string {
  return `verify:${purpose}:email:${email.trim().toLowerCase()}`;
}

export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LEN)).padStart(CODE_LEN, '0');
}

export async function saveCode(email: string, code: string, purpose: CodePurpose): Promise<void> {
  await redis.set(key(purpose, email), code, 'EX', TTL_MIN * 60);
}

export async function consumeCode(
  email: string,
  code: string,
  purpose: CodePurpose,
): Promise<void> {
  const k = key(purpose, email);
  const stored = await redis.get(k);
  if (!stored) throw appError('CODE_EXPIRED', '验证码已过期，请重新获取');
  if (stored !== code) throw appError('CODE_INVALID', '验证码错误');
  await redis.del(k);
}
