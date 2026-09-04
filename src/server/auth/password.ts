import { hash as bcryptHash, verify as bcryptVerify } from '@node-rs/bcrypt';

// 密码哈希：bcrypt(password + pepper)，cost=12。pepper 来自全局 env，可被 per-user 覆盖（迁移用）。
// 用 @node-rs/bcrypt（Rust napi 原生）：跑在 libuv 线程池，不阻塞 event loop——
// 登录风暴（V8 压测 D1）下纯 JS 的 bcryptjs 会把整个进程的其他请求饿死。
// hash 格式与 bcryptjs 双向兼容（$2a/$2b 互认），存量哈希无需迁移。
const GLOBAL_PEPPER = process.env.PASSWORD_PEPPER ?? '';

export function effectivePepper(userPepper?: string | null): string {
  return userPepper ?? GLOBAL_PEPPER;
}

export async function hashPassword(
  password: string,
  pepper: string = GLOBAL_PEPPER,
): Promise<string> {
  return bcryptHash(`${password}${pepper}`, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
  pepper: string = GLOBAL_PEPPER,
): Promise<boolean> {
  return bcryptVerify(`${password}${pepper}`, hash);
}

/** 密码强度：≥8 位且含字母和数字 */
export function isValidPassword(pw: string): boolean {
  return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /\d/.test(pw);
}
