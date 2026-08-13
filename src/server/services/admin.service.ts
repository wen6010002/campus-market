import { prisma } from '../db';
import { appError } from '../lib/errors';

export const adminService = {
  /** 提现审批（complete → 到账；reject → 回滚钱包） */
  async auditPayout(
    payoutId: string,
    action: 'complete' | 'reject',
    opts?: { channelTxId?: string; rejectionReason?: string },
  ) {
    const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw appError('NOT_FOUND', '提现记录不存在');

    if (action === 'complete') {
      const updated = await prisma.payout.update({
        where: { id: payoutId },
        data: {
          status: 'COMPLETED',
          channelTxId: opts?.channelTxId ?? null,
          completedAt: new Date(),
        },
      });
      return updated;
    }

    // reject：回滚钱包（balance+ / withdrawn-）
    return prisma.$transaction(async (tx) => {
      const p = await tx.payout.update({
        where: { id: payoutId },
        data: { status: 'REJECTED', rejectedReason: opts?.rejectionReason ?? null },
      });
      await tx.wallet.update({
        where: { creatorId: payout.creatorId },
        data: { balance: { increment: payout.amount }, withdrawn: { decrement: payout.amount } },
      });
      return p;
    });
  },

  /** 创作者认证审核（approve=true → verified） */
  async auditCreator(userId: string, approve: boolean) {
    const cp = await prisma.creatorProfile.findUnique({ where: { userId } });
    if (!cp) throw appError('NOT_FOUND', '创作者申请不存在');
    return prisma.creatorProfile.update({
      where: { userId },
      data: { verified: approve, reviewedAt: new Date() },
    });
  },
};
