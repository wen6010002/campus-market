import { redis } from './redis';
import { appError } from './errors';

// 基于 Redis 的滑动窗口限流（原子 Lua）。超限返回 Retry-After 秒数。
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window_ms)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry_ms = 0
  if oldest[2] then
    retry_ms = math.max(0, tonumber(oldest[2]) + window_ms - now)
  end
  return {0, count, math.ceil(retry_ms / 1000)}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window_ms)
return {1, count + 1, 0}
`;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfter: number; // 秒
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const member = `${now}:${process.pid}:${Math.random().toString(36).slice(2)}`;
  const res = (await redis.eval(SLIDING_WINDOW_LUA, 1, key, now, windowMs, limit, member)) as [
    number,
    number,
    number,
  ];
  const [ok, count, retryAfter] = res;
  return { ok: ok === 1, remaining: Math.max(0, limit - count), retryAfter };
}

/** 便捷：超限则抛 RATE_LIMITED（details 带 retryAfter 秒） */
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const { ok, retryAfter } = await rateLimit(key, limit, windowMs);
  if (!ok) {
    throw appError('RATE_LIMITED', '操作太频繁，请稍后再试', { retryAfter });
  }
}
