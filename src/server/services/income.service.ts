import { prisma } from '../db';
import { appError } from '../lib/errors';
import type { PayMethod } from '@/lib/constants';

const money = (d: { toFixed(n: number): string } | null | undefined): string =>
  d === null || d === undefined ? '0.00' : d.toFixed(2);

async function getCreatorProfile(userId: string) {
  const cp = await prisma.creatorProfile.findUnique({ where: { userId } });
  if (!cp) throw appError('FORBIDDEN', '需要创作者权限');
  return cp;
}

export const incomeService = {
  /** 收益汇总：total/month/pending/withdrawable */
  async summary(userId: string) {
    const cp = await getCreatorProfile(userId);
    const wallet = await prisma.wallet.findUnique({ where: { creatorId: cp.id } });
    if (!wallet) throw appError('NOT_FOUND', '钱包不存在');

    const [totalAgg, monthAgg] = await Promise.all([
      prisma.creatorIncome.aggregate({ where: { creatorId: cp.id }, _sum: { amount: true } }),
      prisma.creatorIncome.aggregate({
        where: { creatorId: cp.id, createdAt: { gte: monthStart() } },
        _sum: { amount: true },
      }),
    ]);

    return {
      total: money(totalAgg._sum.amount ?? 0),
      month: money(monthAgg._sum.amount ?? 0),
      pending: money(wallet.pending),
      withdrawable: money(wallet.balance),
    };
  },

  /** 收益流水 */
  async transactions(userId: string) {
    const cp = await getCreatorProfile(userId);
    const incomes = await prisma.creatorIncome.findMany({
      where: { creatorId: cp.id },
      include: {
        order: {
          include: { work: { select: { title: true } }, buyer: { select: { username: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return incomes.map((i) => ({
      id: i.id,
      workTitle: i.order.work.title,
      buyer: i.order.buyer.username,
      amount: money(i.amount),
      method: i.order.payMethod,
      createdAt: i.createdAt.toISOString(),
      status: i.status,
    }));
  },

  /** 提现（校验余额，事务迁移 wallet + 建 Payout） */
  async payout(userId: string, amount: number, method: PayMethod) {
    if (amount <= 0) throw appError('VALIDATION', '提现金额需大于 0');
    const cp = await getCreatorProfile(userId);
    const wallet = await prisma.wallet.findUnique({ where: { creatorId: cp.id } });
    if (!wallet) throw appError('NOT_FOUND', '钱包不存在');
    if (amount > Number(wallet.balance)) throw appError('INSUFFICIENT_BALANCE', '可提现余额不足');

    return prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { creatorId: cp.id },
        data: { balance: { decrement: amount }, withdrawn: { increment: amount } },
      });
      return tx.payout.create({ data: { creatorId: cp.id, amount, method, status: 'REQUESTED' } });
    });
  },

  /** 提现记录 */
  async payouts(userId: string) {
    const cp = await getCreatorProfile(userId);
    const list = await prisma.payout.findMany({
      where: { creatorId: cp.id },
      orderBy: { requestedAt: 'desc' },
    });
    return list.map((p) => ({
      id: p.id,
      amount: money(p.amount),
      method: p.method,
      status: p.status,
      requestedAt: p.requestedAt.toISOString(),
      completedAt: p.completedAt?.toISOString() ?? null,
      rejectedReason: p.rejectedReason,
    }));
  },

  /** 结算到期收益（PENDING + settleAt<=now → SETTLED，wallet pending- → balance+） */
  async settleDueIncomes(): Promise<number> {
    const dues = await prisma.creatorIncome.findMany({
      where: { status: 'PENDING', settleAt: { lte: new Date() } },
    });
    for (const income of dues) {
      await prisma.$transaction(async (tx) => {
        await tx.creatorIncome.update({
          where: { id: income.id },
          data: { status: 'SETTLED', settledAt: new Date() },
        });
        await tx.wallet.update({
          where: { creatorId: income.creatorId },
          data: { pending: { decrement: income.amount }, balance: { increment: income.amount } },
        });
      });
    }
    return dues.length;
  },
};

function monthStart(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
