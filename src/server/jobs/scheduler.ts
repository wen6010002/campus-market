// BullMQ 调度器（pnpm worker 启动）：注册定时任务 + 消费。
// 定时任务表见 BACKEND.md §11。
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '../db';
import { redis } from '../lib/redis';
import { cacheDel } from '../lib/cache';
import { incomeService } from '../services/income.service';
import { qualityService } from '../services/quality.service';
import { logger } from '../lib/logger';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// BullMQ 要求 maxRetriesPerRequest=null（长连接阻塞）
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

const queue = new Queue('campus-jobs', { connection });

const SCHEDULES: Array<[string, string]> = [
  ['income-settle', '0 3 * * *'], // 每日 3 点结算到期收益
  ['quality-refresh', '30 3 * * *'], // 每日 3:30 质量升降级
  ['order-timeout', '* * * * *'], // 每分钟关闭超时订单
  ['rank-refresh', '0 * * * *'], // 每小时刷新榜单（当前按需计算，此任务预留）
  ['notification-cleanup', '0 4 * * 0'], // 每周日 4 点清理 90 天已读通知
  ['view-sync', '*/5 * * * *'], // 每 5 分钟回写 views 异步计数到 DB
];

async function closeExpiredOrders() {
  const res = await prisma.order.updateMany({
    where: { payStatus: 'PENDING', expiresAt: { lt: new Date() } },
    data: { payStatus: 'CLOSED' },
  });
  return res.count;
}

async function cleanupNotifications() {
  const cutoff = new Date(Date.now() - 90 * 86400_000);
  const res = await prisma.notification.deleteMany({
    where: { read: true, createdAt: { lt: cutoff } },
  });
  return res.count;
}

/** 回写 views 异步计数到 DB（view:* → work.views increment + DEL + 失效详情缓存） */
async function syncViews() {
  const keys = await redis.keys('view:*');
  let synced = 0;
  for (const key of keys) {
    const workId = key.slice('view:'.length);
    const count = Number(await redis.get(key));
    if (count > 0) {
      await prisma.work.update({ where: { id: workId }, data: { views: { increment: count } } });
      await cacheDel(`work:detail:${workId}`);
      synced++;
    }
    await redis.del(key);
  }
  return synced;
}

async function run(jobName: string) {
  switch (jobName) {
    case 'income-settle': {
      const n = await incomeService.settleDueIncomes();
      logger.info({ n }, 'income-settle done');
      break;
    }
    case 'quality-refresh': {
      const r = await qualityService.refreshQuality();
      logger.info(r, 'quality-refresh done');
      break;
    }
    case 'order-timeout': {
      const n = await closeExpiredOrders();
      if (n > 0) logger.info({ n }, 'order-timeout closed');
      break;
    }
    case 'notification-cleanup': {
      const n = await cleanupNotifications();
      if (n > 0) logger.info({ n }, 'notification-cleanup deleted');
      break;
    }
    case 'view-sync': {
      const n = await syncViews();
      if (n > 0) logger.info({ n }, 'view-sync flushed');
      break;
    }
    default:
      break; // rank-refresh：榜单按需计算，暂不落缓存
  }
}

async function main() {
  for (const [name, pattern] of SCHEDULES) {
    await queue.add(name, {}, { repeat: { pattern }, removeOnComplete: true, removeOnFail: 100 });
  }
  logger.info({ schedules: SCHEDULES.map(([n]) => n) }, 'scheduler registered');

  const worker = new Worker(
    'campus-jobs',
    async (job) => {
      try {
        await run(job.name);
      } catch (e) {
        logger.error({ err: e, job: job.name }, 'job failed');
        throw e;
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => logger.error({ job: job?.name, err }, 'worker job failed'));
  logger.info('worker started');
}

main().catch((e) => {
  logger.error({ err: e }, 'scheduler fatal');
  process.exit(1);
});
