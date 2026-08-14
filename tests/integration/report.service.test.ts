// 阶段 9 测试：举报创建/处置 + 提现审批(拒绝回滚) + 创作者认证审核。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { prisma } from '@/server/db';
import { redis } from '@/server/lib/redis';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';
import { reportService } from '@/server/services/report.service';
import { adminService } from '@/server/services/admin.service';
import { authService } from '@/server/services/auth.service';
import { saveCode } from '@/server/auth/verify-code';

const TEST_URL = process.env.DATABASE_URL_TEST!;

beforeAll(async () => {
  execSync('pnpm exec prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'ignore',
  });
  await flushDb(prisma);
  await seedTestData(prisma);
  // 清限流 key，避免跨 run 残留导致 RATE_LIMITED
  const keys = await redis.keys('rl:*');
  if (keys.length) await redis.del(...keys);
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

  it('用户列表脱敏：不含 passwordHash/passwordPepper', async () => {
    const result = await adminService.listUsers({ page: 1, pageSize: 20 });
    const raw = JSON.stringify(result.data);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('passwordPepper');
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('封号后登录 → FORBIDDEN', async () => {
    const email = `ban-${Date.now()}@szu.edu.cn`;
    await saveCode(email, '123456');
    const { userId } = await authService.register({
      email,
      code: '123456',
      username: `封测${Date.now()}`,
      password: 'demo1234',
      school: '深圳大学',
      college: '计软',
      major: '计算机',
      grade: '大二',
    });
    await adminService.banUser(userId, '违规');
    await expect(authService.login({ email, password: 'demo1234' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('改角色生效 + 封管理员被拒', async () => {
    await adminService.setRole('stu_test', 'ADMIN');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: 'stu_test' } })).role).toBe('ADMIN');
    await expect(adminService.banUser('stu_test', 'x')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await adminService.setRole('stu_test', 'STUDENT'); // 恢复
  });
});
