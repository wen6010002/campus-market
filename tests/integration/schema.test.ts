// 阶段 1 测试：迁移/seed 行数 + 唯一约束（重复关注/评分）抛错。
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';

const TEST_URL = process.env.DATABASE_URL_TEST!;
const prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });

beforeAll(async () => {
  // 同步 schema 到测试库（幂等）
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

describe('数据模型（阶段 1）', () => {
  it('seed 后各表行数正确', async () => {
    expect(await prisma.user.count()).toBe(2);
    expect(await prisma.work.count()).toBe(1);
    expect(await prisma.achievement.count()).toBe(4);
    expect(await prisma.creatorProfile.count()).toBe(1);
    expect(await prisma.studentProfile.count()).toBe(2);
  });

  it('重复关注触发唯一约束（P2002）', async () => {
    await prisma.follow.create({ data: { followerId: 'stu_test', followingId: 'creator_test' } });
    await expect(
      prisma.follow.create({ data: { followerId: 'stu_test', followingId: 'creator_test' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('每人每作品一次评分触发唯一约束（P2002）', async () => {
    await prisma.workRating.create({
      data: { workId: 'work_test', userId: 'stu_test', stars: 5, text: '好评好评好评' },
    });
    await expect(
      prisma.workRating.create({
        data: { workId: 'work_test', userId: 'stu_test', stars: 4, text: '再次评价' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('用户名/邮箱唯一约束（P2002）', async () => {
    await expect(
      prisma.user.create({
        data: { email: 'other@szu.edu.cn', username: '测试学生', passwordHash: 'x' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
