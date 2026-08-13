// 阶段 7 测试：收益汇总 / 结算迁移 / 提现超额 / 钱包。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { prisma } from '@/server/db';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';
import { incomeService } from '@/server/services/income.service';

const TEST_URL = process.env.DATABASE_URL_TEST!;
const CREATOR = 'creator_test';

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

async function creatorProfileId() {
  return (await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: CREATOR } })).id;
}

describe('收益服务（阶段 7）', () => {
  it('收益汇总：空钱包返回 0', async () => {
    const summary = await incomeService.summary(CREATOR);
    expect(summary.total).toBe('0.00');
    expect(summary.withdrawable).toBe('0.00');
    expect(summary.pending).toBe('0.00');
  });

  it('结算：PENDING → SETTLED + 钱包迁移 pending→balance', async () => {
    const cpId = await creatorProfileId();
    const order = await prisma.order.create({
      data: {
        id: 'o_settle',
        workId: 'work_test',
        buyerId: 'stu_test',
        amount: 9.9,
        platformFee: 0.99,
        creatorAmount: 8.91,
        payMethod: 'MOCK',
        payStatus: 'PAID',
      },
    });
    await prisma.creatorIncome.create({
      data: {
        creatorId: cpId,
        orderId: order.id,
        amount: 8.91,
        status: 'PENDING',
        settleAt: new Date(Date.now() - 1000),
      },
    });
    // 预置钱包 pending
    await prisma.wallet.update({ where: { creatorId: cpId }, data: { pending: 8.91 } });

    const settled = await incomeService.settleDueIncomes();
    expect(settled).toBe(1);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { creatorId: cpId } });
    expect(wallet.balance.toFixed(2)).toBe('8.91');
    expect(wallet.pending.toFixed(2)).toBe('0.00');
    const income = await prisma.creatorIncome.findUniqueOrThrow({ where: { orderId: 'o_settle' } });
    expect(income.status).toBe('SETTLED');
  });

  it('提现：超额 → INSUFFICIENT_BALANCE', async () => {
    await expect(incomeService.payout(CREATOR, 9999, 'WECHAT')).rejects.toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
    });
  });

  it('提现：余额内 → 建 Payout + 钱包迁移', async () => {
    const cpId = await creatorProfileId();
    const before = await prisma.wallet.findUniqueOrThrow({ where: { creatorId: cpId } });
    const payout = await incomeService.payout(CREATOR, 5, 'WECHAT');
    expect(payout.status).toBe('REQUESTED');
    const after = await prisma.wallet.findUniqueOrThrow({ where: { creatorId: cpId } });
    expect(after.balance.toFixed(2)).toBe((before.balance.toNumber() - 5).toFixed(2));
    expect(after.withdrawn.toFixed(2)).toBe((before.withdrawn.toNumber() + 5).toFixed(2));
  });

  it('非创作者 → FORBIDDEN', async () => {
    await expect(incomeService.summary('stu_test')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
