import { execSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/server/db';
import { adminService } from '@/server/services/admin.service';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';

const TEST_URL = process.env.DATABASE_URL_TEST!;

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

describe('管理员资料归属转移', () => {
  it('转移作品和发布动态，但保留历史收入归属并写审计日志', async () => {
    const target = await prisma.user.create({
      data: {
        id: 'target_test',
        email: 'target@szu.edu.cn',
        username: '接收创作者',
        passwordHash: 'hash',
        role: 'CREATOR',
        creator: {
          create: {
            bio: '',
            direction: '校园分享者',
            wallet: { create: {} },
          },
        },
      },
      include: { creator: true },
    });
    await prisma.dynamic.create({
      data: { creatorId: 'creator_test', type: 'PUBLISH', workId: 'work_test' },
    });
    const order = await prisma.order.create({
      data: {
        workId: 'work_test',
        buyerId: 'stu_test',
        amount: 10,
        platformFee: 1,
        creatorAmount: 9,
        payMethod: 'WECHAT',
        payStatus: 'PAID',
        paidAt: new Date(),
      },
    });
    const originalCreator = await prisma.creatorProfile.findUniqueOrThrow({
      where: { userId: 'creator_test' },
    });
    await prisma.creatorIncome.create({
      data: { creatorId: originalCreator.id, orderId: order.id, amount: 9 },
    });

    const result = await adminService.transferWorks('creator_test', {
      workIds: ['work_test'],
      targetEmail: 'TARGET@szu.edu.cn',
      reason: '原作者书面授权',
    });

    expect(result.count).toBe(1);
    expect((await prisma.work.findUniqueOrThrow({ where: { id: 'work_test' } })).authorId).toBe(
      target.id,
    );
    expect(
      (await prisma.dynamic.findFirstOrThrow({ where: { workId: 'work_test' } })).creatorId,
    ).toBe(target.id);
    expect(
      (await prisma.creatorIncome.findUniqueOrThrow({ where: { orderId: order.id } })).creatorId,
    ).toBe(originalCreator.id);
    const log = await prisma.auditLog.findFirstOrThrow({
      where: { workId: 'work_test', action: 'TRANSFER' },
    });
    expect(log.note).toContain('原作者书面授权');
    expect(log.note).toContain('"historicalIncomeTransferred":false');
    expect(target.creator).not.toBeNull();
  });

  it('拒绝转移给没有创作者档案的账号', async () => {
    await expect(
      adminService.transferWorks('creator_test', {
        workIds: ['work_test'],
        targetEmail: 'stu@szu.edu.cn',
        reason: '测试',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
