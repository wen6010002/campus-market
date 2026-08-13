import bcrypt from 'bcryptjs';

// 密码哈希：bcrypt(password + pepper)，cost=12。pepper 来自全局 env，可被 per-user 覆盖（迁移用）。
const GLOBAL_PEPPER = process.env.PASSWORD_PEPPER ?? '';

export function effectivePepper(userPepper?: string | null): string {
  return userPepper ?? GLOBAL_PEPPER;
}

export async function hashPassword(
  password: string,
  pepper: string = GLOBAL_PEPPER,
): Promise<string> {
  return bcrypt.hash(`${password}${pepper}`, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
  pepper: string = GLOBAL_PEPPER,
): Promise<boolean> {
  return bcrypt.compare(`${password}${pepper}`, hash);
}

/** 密码强度：≥8 位且含字母和数字 */
export function isValidPassword(pw: string): boolean {
  return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /\d/.test(pw);
}
