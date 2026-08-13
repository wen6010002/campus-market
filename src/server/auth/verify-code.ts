import { randomInt } from 'node:crypto';
import { redis } from '../lib/redis';
import { appError } from '../lib/errors';

// edu 邮箱验证码：Redis 存 6 位码，TTL 10 分钟。
const TTL_MIN = Number(process.env.VERIFY_CODE_TTL_MIN ?? 10);
const CODE_LEN = Number(process.env.VERIFY_CODE_LEN ?? 6);

export const EDU_EMAIL_REGEX = new RegExp(
  process.env.EDU_EMAIL_REGEX ?? '^[^@]+@([a-zA-Z0-9-]+\\.)?edu\\.cn$',
);

export function isEduEmail(email: string): boolean {
  return EDU_EMAIL_REGEX.test(email.trim());
}

function key(email: string): string {
  return `verify:email:${email.trim().toLowerCase()}`;
}

export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LEN)).padStart(CODE_LEN, '0');
}

export async function saveCode(email: string, code: string): Promise<void> {
  await redis.set(key(email), code, 'EX', TTL_MIN * 60);
}

export async function consumeCode(email: string, code: string): Promise<void> {
  const k = key(email);
  const stored = await redis.get(k);
  if (!stored) throw appError('CODE_EXPIRED', '验证码已过期，请重新获取');
  if (stored !== code) throw appError('CODE_INVALID', '验证码错误');
  await redis.del(k);
}
