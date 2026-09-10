// BullMQ 调度器（pnpm worker 启动）：注册定时任务 + 消费（含 V12 on-demand 任务）。
// 定时任务表见 BACKEND.md §11。
import { Worker } from 'bullmq';
import { prisma } from '../db';
import { redis } from '../lib/redis';
import { cacheDel } from '../lib/cache';
import { incomeService } from '../services/income.service';
import { qualityService } from '../services/quality.service';
import { achievementService } from '../services/achievement.service';
import { commentService } from '../services/comment.service';
import { logger } from '../lib/logger';
import { assertProdEnv } from '../lib/env';
import { getQueue, getQueueConnection } from './queue';

// worker 容器用 tsx 直启、不经 Next instrumentation，生产 env 自检在此触发
assertProdEnv();

const connection = getQueueConnection();
const queue = getQueue();

const SCHEDULES: Array<[string, string]> = [
  ['income-settle', '0 3 * * *'], // 每日 3 点结算到期收益
  ['quality-refresh', '30 3 * * *'], // 每日 3:30 质量升降级
  ['order-timeout', '* * * * *'], // 每分钟关闭超时订单
  ['rank-refresh', '0 * * * *'], // 每小时刷新榜单（当前按需计算，此任务预留）
  ['notification-cleanup', '0 4 * * 0'], // 每周日 4 点清理 90 天已读通知
  ['achievement-weekly', '40 3 * * 1'], // V8 每周一 3:40 周榜 Top3 授「燎原之火」(7天)
  ['achievement-monthly', '50 3 1 * *'], // V8 每月 1 号 3:50 月榜 Top1 授「月度桂冠」(30天)
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

async function run(jobName: string, data: Record<string, unknown> = {}) {
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
    case 'achievement-weekly': {
      // 周下载榜 Top3 → 燎原之火（7 天限时，可卫冕续期）
      const n = await achievementService.grantLeaderboard('WEEKLY_HOT', 3, 7);
      logger.info({ n }, 'achievement-weekly done');
      break;
    }
    case 'achievement-monthly': {
      // 月下载榜 Top1 → 月度桂冠（30 天限时）
      const n = await achievementService.grantLeaderboard('MONTHLY_STAR', 1, 30);
      logger.info({ n }, 'achievement-monthly done');
      break;
    }
    case 'view-sync': {
      const n = await syncViews();
      if (n > 0) logger.info({ n }, 'view-sync flushed');
      break;
    }
    case 'comment-moderate': {
      // V12 评论 AI 审核（on-demand）：commentId 由 enqueue 传入，幂等
      const commentId = (data as { commentId?: string }).commentId;
      if (commentId) await commentService.moderateComment(commentId);
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
        await run(job.name, job.data as Record<string, unknown>);
      } catch (e) {
        logger.error({ err: e, job: job.name }, 'job failed');
        throw e;
      }
    },
    { connection },
  );

  worker.on('failed', async (job, err) => {
    logger.error({ job: job?.name, err }, 'worker job failed');
    // V12 评论审核重试耗尽 → fail-closed：评论转人工待审（绝不无审核放行）
    const attempts = job?.opts?.attempts ?? 1;
    if (job?.name === 'comment-moderate' && job.attemptsMade >= attempts) {
      const commentId = (job.data as { commentId?: string }).commentId;
      if (commentId) {
        try {
          await commentService.failCloseComment(commentId);
        } catch (e) {
          logger.error({ err: e, commentId }, 'comment-moderate fail-close 失败');
        }
      }
    }
  });
  logger.info('worker started');
}

main().catch((e) => {
  logger.error({ err: e }, 'scheduler fatal');
  process.exit(1);
});
