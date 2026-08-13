// 阶段 5 测试：评分资格 / 重算 / 唯一约束 / 标签 / 作者回复 / helpful 去重 / 并发。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { prisma } from '@/server/db';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';
import { ratingService } from '@/server/services/rating.service';

const TEST_URL = process.env.DATABASE_URL_TEST!;
const CREATOR_ID = 'creator_test';
const STUDENT_ID = 'stu_test';
const WORK_ID = 'work_test';

beforeAll(async () => {
  execSync('pnpm exec prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'ignore',
  });
  await flushDb(prisma);
  await seedTestData(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function grantAccess(userId: string) {
  await prisma.download.create({ data: { workId: WORK_ID, userId } });
}

describe('评分服务（阶段 5）', () => {
  it('资格：未下载/未购 → NO_RATING_ACCESS', async () => {
    await expect(
      ratingService.create(STUDENT_ID, WORK_ID, { stars: 5, text: '很好很好很好', tags: [] }),
    ).rejects.toMatchObject({ code: 'NO_RATING_ACCESS' });
  });

  it('提交评分：重算 Work 均值/分布 + 标签', async () => {
    await grantAccess(STUDENT_ID);
    const before = await prisma.work.findUniqueOrThrow({ where: { id: WORK_ID } });
    const rating = await ratingService.create(STUDENT_ID, WORK_ID, {
      stars: 5,
      text: '内容整理得很好，很有帮助',
      tags: ['内容详细', '很有帮助'],
    });
    expect(rating.stars).toBe(5);
    expect(rating.tags).toEqual(['内容详细', '很有帮助']);

    const after = await prisma.work.findUniqueOrThrow({ where: { id: WORK_ID } });
    expect(after.ratingCount).toBe(before.ratingCount + 1);
    const dist = after.ratingDist as Record<string, number>;
    expect(dist['5']).toBe((before.ratingDist as Record<string, number>)['5'] + 1);
  });

  it('重复评分 → ALREADY_RATED', async () => {
    await expect(
      ratingService.create(STUDENT_ID, WORK_ID, { stars: 4, text: '再次评价一下', tags: [] }),
    ).rejects.toMatchObject({ code: 'ALREADY_RATED' });
  });

  it('作者回复：仅该作品作者可回复', async () => {
    const rating = await prisma.workRating.findFirstOrThrow({
      where: { workId: WORK_ID, userId: STUDENT_ID },
    });
    await expect(ratingService.reply(rating.id, STUDENT_ID, '我不是作者')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    const replied = await ratingService.reply(rating.id, CREATOR_ID, '谢谢支持！');
    expect(replied.creatorReply).toBe('谢谢支持！');
  });

  it('有用：去重（每人每评一次）', async () => {
    const rating = await prisma.workRating.findFirstOrThrow({
      where: { workId: WORK_ID, userId: STUDENT_ID },
    });
    const r1 = await ratingService.helpful(rating.id, 'other_user');
    const r2 = await ratingService.helpful(rating.id, 'other_user');
    expect(r2.helpfulCount).toBe(r1.helpfulCount); // 第二次不 +1
  });

  it('并发评分：FOR UPDATE 锁保证计数正确', async () => {
    // 10 个并发用户同时评分（各需 access）
    const users = Array.from({ length: 10 }, (_, i) => `concurrent_${i}`);
    await Promise.all(
      users.map(async (u) => {
        await prisma.user.create({
          data: { id: u, email: `${u}@szu.edu.cn`, username: u, passwordHash: 'x' },
        });
        await grantAccess(u);
      }),
    );
    const before = await prisma.work.findUniqueOrThrow({ where: { id: WORK_ID } });
    await Promise.all(
      users.map((u) =>
        ratingService.create(u, WORK_ID, { stars: 5, text: '并发评分测试内容', tags: [] }),
      ),
    );
    const after = await prisma.work.findUniqueOrThrow({ where: { id: WORK_ID } });
    expect(after.ratingCount).toBe(before.ratingCount + 10);
  });

  it('评价列表 + 汇总', async () => {
    const result = await ratingService.list(WORK_ID, 'new', 1, 10);
    expect(result.pagination.total).toBe(
      await prisma.workRating.count({ where: { workId: WORK_ID } }),
    );
    expect(result.summary.ratingCount).toBe(
      (await prisma.work.findUniqueOrThrow({ where: { id: WORK_ID } })).ratingCount,
    );
  });
});
