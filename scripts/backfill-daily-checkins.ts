/**
 * V12 一次性回填：从 roadmap_checks 历史推导 DailyCheckin 账本（保证老用户 streak 不清零）。
 *
 * 运行：pnpm tsx scripts/backfill-daily-checkins.ts（指向 .env 的 DATABASE_URL；
 * 生产部署时在宿主机跑——app 镜像是 standalone 没有 tsx）。
 * 幂等：upsert，重复跑无副作用。跑完输出每用户最终 streak。
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** 与 src/lib/day.ts 同口径（脚本自包含，避免路径别名问题） */
function dayCn8(d: Date): string {
  return new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

async function main() {
  const rows = await prisma.roadmapCheck.findMany({
    select: { userId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  // userId → 去重日期集合
  const byUser = new Map<string, Set<string>>();
  for (const r of rows) {
    const days = byUser.get(r.userId) ?? new Set<string>();
    days.add(dayCn8(r.createdAt));
    byUser.set(r.userId, days);
  }

  let created = 0;
  for (const [userId, daySet] of byUser) {
    const sorted = [...daySet].sort();
    let streak = 0;
    let prev: string | null = null;
    for (const day of sorted) {
      // 相邻日（UTC+8 日历日）连续则 +1，否则归 1
      const gap = prev ? Math.round((Date.parse(day) - Date.parse(prev)) / 86400_000) : Infinity;
      streak = gap === 1 ? streak + 1 : 1;
      const res = await prisma.dailyCheckin.upsert({
        where: { userId_day: { userId, day } },
        update: {},
        create: { userId, day, streakDays: streak },
      });
      created++;
      prev = day;
      console.log(`  ${userId} ${day} streak=${streak} (id=${res.id})`);
    }
  }
  console.log(`\n回填完成：${byUser.size} 个用户，${created} 行（含已存在跳过的 upsert）`);
  // 汇总每用户当前 streak
  const all = await prisma.dailyCheckin.findMany({ orderBy: { day: 'asc' } });
  const last = new Map<string, { day: string; streakDays: number }>();
  for (const r of all) last.set(r.userId, { day: r.day, streakDays: r.streakDays });
  for (const [userId, info] of last) {
    console.log(`  ${userId}: 最后打卡 ${info.day}，连续 ${info.streakDays} 天`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
