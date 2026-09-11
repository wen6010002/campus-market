// V12 打卡站内统计集成测试：toggleCheck 写账本（streak 接续/幂等/取消不回滚）、
// checkinStats、progress 站内口径、checkin 榜排序与并列名次。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('@/server/jobs/queue', () => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
  getQueue: vi.fn(),
  getQueueConnection: vi.fn(),
}));

import { prisma } from '@/server/db';
import { redis } from '@/server/lib/redis';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';
import { roadmapService } from '@/server/services/roadmap.service';
import { rankService } from '@/server/services/rank.service';
import { dayCn8 } from '@/lib/day';

const TEST_URL = process.env.DATABASE_URL_TEST!;
const CREATOR_ID = 'creator_test';
const STUDENT_ID = 'stu_test';
const RM_ID = 'rm_test';
const RM2_ID = 'rm_test2';

const CONTENT = {
  phases: [
    {
      title: '阶段一',
      desc: '',
      steps: [
        { id: 'p0-s0', text: 'a' },
        { id: 'p0-s1', text: 'b' },
      ],
    },
  ],
};

async function seedRoadmaps() {
  for (const id of [RM_ID, RM2_ID]) {
    await prisma.roadmap.upsert({
      where: { id },
      update: {},
      create: {
        id,
        title: `路线图 ${id}`,
        summary: '打卡测试',
        uploaderId: CREATOR_ID,
        status: 'PUBLISHED',
        stepsCount: 2,
        content: CONTENT,
        mdSourceKey: `roadmaps/test/${id}.md`,
        publishedAt: new Date(),
      },
    });
  }
}

async function clearGuards() {
  const keys = await redis.keys('rl:check:*');
  if (keys.length) await redis.del(...keys);
}

beforeAll(async () => {
  execSync('pnpm exec prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'ignore',
  });
  await flushDb(prisma);
  await seedTestData(prisma);
  await seedRoadmaps();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('V12 打卡站内账本', () => {
  beforeEach(clearGuards);

  it('勾选即记账：昨日有行 → 今日 streak=昨日+1；跨路线同日幂等', async () => {
    // 昨日 streak=2（直接造账本行，模拟历史）
    const yesterday = dayCn8(new Date(Date.now() - 86400_000));
    await prisma.dailyCheckin.create({
      data: { userId: STUDENT_ID, day: yesterday, streakDays: 2 },
    });

    // 今天：路线 A 勾一步
    await roadmapService.toggleCheck(STUDENT_ID, RM_ID, 'p0-s0', true);
    const today = dayCn8(new Date());
    let todayRow = await prisma.dailyCheckin.findUniqueOrThrow({
      where: { userId_day: { userId: STUDENT_ID, day: today } },
    });
    expect(todayRow.streakDays).toBe(3); // 2+1

    // 同日在另一条路线再勾一步：账本幂等（streak 不变）
    await roadmapService.toggleCheck(STUDENT_ID, RM2_ID, 'p0-s0', true);
    todayRow = await prisma.dailyCheckin.findUniqueOrThrow({
      where: { userId_day: { userId: STUDENT_ID, day: today } },
    });
    expect(todayRow.streakDays).toBe(3);

    // stats
    const stats = await roadmapService.checkinStats(STUDENT_ID);
    expect(stats).toMatchObject({ today: true, streakDays: 3, totalDays: 2 });
    expect(stats.byDay[today]).toBeGreaterThanOrEqual(2); // 两步
  });

  it('断签归 1：昨日无行 → 今日 streak=1', async () => {
    // creator_test 昨日无行
    await roadmapService.toggleCheck(CREATOR_ID, RM_ID, 'p0-s0', true);
    const today = dayCn8(new Date());
    const row = await prisma.dailyCheckin.findUniqueOrThrow({
      where: { userId_day: { userId: CREATOR_ID, day: today } },
    });
    expect(row.streakDays).toBe(1);
  });

  it('取消勾选不回滚账本（修复旧缺陷），但热力图步数归零、账本日兜底 ≥1', async () => {
    await roadmapService.toggleCheck(STUDENT_ID, RM_ID, 'p0-s0', true);
    await roadmapService.toggleCheck(STUDENT_ID, RM_ID, 'p0-s0', false); // 取消
    const today = dayCn8(new Date());
    // 账本行仍在（今天还打过——之前用例已建行；此处验证取消后不删除）
    const row = await prisma.dailyCheckin.findFirst({
      where: { userId: STUDENT_ID, day: today },
    });
    expect(row).toBeTruthy();
    // byDay：当日该步骤被取消 → 计数回落；但账本日保证 ≥1
    const stats = await roadmapService.checkinStats(STUDENT_ID);
    expect(stats.byDay[today]).toBeGreaterThanOrEqual(1);
  });

  it('progress：站内口径（checked 是本图勾选，streak 是全站）', async () => {
    // 学生在本图勾 1 步（另一图的勾选不计入本图 checked）
    await roadmapService.toggleCheck(STUDENT_ID, RM_ID, 'p0-s1', true);
    const p = await roadmapService.progress(STUDENT_ID, RM_ID);
    expect(p.checked.some((c) => c.stepId === 'p0-s1')).toBe(true);
    expect(p.checked.some((c) => c.stepId === 'p0-s0')).toBe(false); // 上一用例取消了
    expect(p.stepsCount).toBe(2);
    // streak 与 stats 一致（单一事实源）
    const stats = await roadmapService.checkinStats(STUDENT_ID);
    expect(p.streakDays).toBe(stats.streakDays);
  });
});

describe('V12 连续打卡榜（checkin 分支）', () => {
  beforeEach(async () => {
    await clearGuards();
    await prisma.dailyCheckin.deleteMany();
    const keys = await redis.keys('rank:*');
    if (keys.length) await redis.del(...keys);
  });

  it('按连续天数排序，同分早达成优先，dorm 优先 college 回退', async () => {
    const today = dayCn8(new Date());
    await prisma.user.update({ where: { id: STUDENT_ID }, data: { dorm: '紫薇斋' } });
    await prisma.dailyCheckin.create({
      data: {
        userId: STUDENT_ID,
        day: today,
        streakDays: 10,
        createdAt: new Date(Date.now() - 3600_000),
      },
    });
    await prisma.dailyCheckin.create({
      data: { userId: CREATOR_ID, day: today, streakDays: 10, createdAt: new Date() }, // 同分但更晚
    });
    const third = await prisma.user.create({
      data: {
        email: 'third@szu.edu.cn',
        username: '第三同学',
        passwordHash: 'hash',
        passwordPepper: 'seed',
      },
    });
    await prisma.dailyCheckin.create({
      data: { userId: third.id, day: today, streakDays: 5 },
    });

    const rows = (await rankService.ranks('checkin')) as Array<any>;
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ rank: 1, metric: 10 });
    expect(rows[0].user.id).toBe(STUDENT_ID); // 同分早达成者优先
    expect(rows[0].user.dorm).toBe('紫薇斋');
    expect(rows[0].today).toBe(true); // 今日已打卡标识（V12.1）
    expect(rows[1].user.id).toBe(CREATOR_ID);
    expect(rows[2]).toMatchObject({ rank: 3, metric: 5 });
    // creator 无 dorm → college 回退（seed 的计软）
    expect(rows[1].user.college).toBe('计软');

    // 缓存生效：改库后再读仍是旧结果（300s TTL）
    await prisma.dailyCheckin.update({
      where: { userId_day: { userId: third.id, day: today } },
      data: { streakDays: 99 },
    });
    const cached = (await rankService.ranks('checkin')) as Array<any>;
    expect(cached[2].metric).toBe(5);
  });

  it('昨日行也上榜（今天还没打，streak 未断）', async () => {
    const yesterday = dayCn8(new Date(Date.now() - 86400_000));
    await prisma.dailyCheckin.create({
      data: { userId: STUDENT_ID, day: yesterday, streakDays: 7 },
    });
    const rows = (await rankService.ranks('checkin')) as Array<any>;
    expect(rows[0]).toMatchObject({ metric: 7, rank: 1 });
    expect(rows[0].today).toBe(false); // 只打了昨天，今日标识不亮
  });
});
