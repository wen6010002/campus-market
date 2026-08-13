import { Redis } from 'ioredis';

// Redis 单例（懒连接，避免测试/无 Redis 环境启动即报错）
const globalForRedis = globalThis as unknown as { redis?: Redis };

function create(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
}

export const redis = globalForRedis.redis ?? create();

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
