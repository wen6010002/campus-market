/**
 * 共享 BullMQ 队列（V12）：app 容器（API 进程 enqueue）与 worker 容器（消费）
 * 连同一 Redis 上的 campus-jobs 队列。原 scheduler.ts 内联建队，现抽出共享，
 * 评论创建等 API 路径可直接 enqueue on-demand 任务（worker 的 run() 加 case 消费）。
 */
import { Queue } from 'bullmq';
import type { JobsOptions } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// dev 热重载下 global 缓存连接/队列，避免反复建连
const g = globalThis as unknown as {
  __cmQueueConn?: IORedis;
  __cmQueue?: Queue;
};

/** BullMQ 要求 maxRetriesPerRequest=null（长连接阻塞命令） */
export function getQueueConnection(): IORedis {
  if (!g.__cmQueueConn) {
    g.__cmQueueConn = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  }
  return g.__cmQueueConn;
}

export function getQueue(): Queue {
  if (!g.__cmQueue) {
    g.__cmQueue = new Queue('campus-jobs', { connection: getQueueConnection() });
  }
  return g.__cmQueue;
}

/** on-demand 任务入队（定时任务仍由 scheduler 的 SCHEDULES 注册） */
export function enqueue(name: string, data: Record<string, unknown>, opts?: JobsOptions) {
  return getQueue().add(name, data, { removeOnComplete: true, removeOnFail: 500, ...opts });
}
