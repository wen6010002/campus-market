// 阶段 9 测试：举报创建/处置 + 提现审批(拒绝回滚) + 创作者认证审核。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { prisma } from '@/server/db';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';
import { reportService } from '@/server/services/report.service';
import { adminService } from '@/server/services/admin.service';

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

describe('治理服务（阶段 9）', () => {
  it('举报：创建 → OPEN，管理员可列出并处置', async () => {
    const report = await reportService.create('stu_test', {
      targetType: 'WORK',
      targetId: 'work_test',
      reason: 'MISMATCH',
      detail: '内容与描述不符',
    });
    expect(report.status).toBe('OPEN');

    const list = await reportService.adminList();
    expect(list.some((r) => r.id === report.id)).toBe(true);

    const handled = await reportService.adminHandle(
      report.id,
      'RESOLVED',
      '已处理',
      'creator_test',
    );
    expect(handled.status).toBe('RESOLVED');
  });

  it('提现审批：拒绝 → 回滚钱包', async () => {
    const cpId = (
      await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: 'creator_test' } })
    ).id;
    await prisma.wallet.update({
      where: { creatorId: cpId },
      data: { balance: 100, withdrawn: 0 },
    });
    const payout = await prisma.payout.create({
      data: { creatorId: cpId, amount: 30, method: 'WECHAT', status: 'REQUESTED' },
    });
    const before = await prisma.wallet.findUniqueOrThrow({ where: { creatorId: cpId } });
    // 模拟提现已扣减 balance
    await prisma.wallet.update({
      where: { creatorId: cpId },
      data: { balance: { decrement: 30 }, withdrawn: { increment: 30 } },
    });

    const rejected = await adminService.auditPayout(payout.id, 'reject', {
      rejectionReason: '信息不符',
    });
    expect(rejected.status).toBe('REJECTED');
    const after = await prisma.wallet.findUniqueOrThrow({ where: { creatorId: cpId } });
    expect(after.balance.toFixed(2)).toBe(before.balance.toFixed(2)); // 回滚后恢复
  });

  it('创作者认证审核：approve → verified', async () => {
    // stu_test 无创作者档案，先申请
    await prisma.creatorProfile.create({
      data: {
        userId: 'stu_test',
        bio: 'x',
        direction: 'AI',
        verified: false,
        wallet: { create: { balance: 0, pending: 0, withdrawn: 0 } },
      },
    });
    const approved = await adminService.auditCreator('stu_test', true);
    expect(approved.verified).toBe(true);
  });
});
