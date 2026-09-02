import { redis } from './redis';

// Redis 缓存封装（JSON 序列化 + SET EX）。
export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSec);
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}

/** 按模式删除（如 works:list:*） */
export async function cacheDelByPattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length) await redis.del(...keys);
}

// ---------- 约定 key（性能优化 V4.1）----------
// 用户状态（封禁拦截）：值 { status, bannedReason } | false（用户不存在）；封/解封时主动失效
export const userStatusKey = (id: string) => `user:status:${id}`;
// /auth/me 聚合响应：值 = buildAuthUser 结果；资料/通知/公告/封禁变化时主动失效
export const meKey = (id: string) => `me:${id}`;
