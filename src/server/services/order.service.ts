import { prisma } from '../db';
import { appError } from '../lib/errors';
import { presignGet } from '../storage/minio';
import { getProvider } from '../payment';
import type { PayParams } from '../payment';
import { splitFee, settleAt } from '../algos/income';
import { PayMethod, PayStatus } from '@/lib/constants';

const ORDER_TIMEOUT_MIN = Number(process.env.ORDER_TIMEOUT_MIN ?? 15);

const money = (d: { toFixed(n: number): string }): string => d.toFixed(2);

function toOrder(o: any) {
  return {
    id: o.id,
    workId: o.workId,
    buyerId: o.buyerId,
    amount: money(o.amount),
    payStatus: o.payStatus,
    payMethod: o.payMethod,
    paidAt: o.paidAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
  };
}

export const orderService = {
  /** 下单（幂等：已购/已下载 → access；PENDING 复用） */
  async createOrder(userId: string, workId: string, payMethod: PayMethod) {
    const work = await prisma.work.findFirst({
      where: { id: workId, deletedAt: null, status: 'PUBLISHED' },
    });
    if (!work) throw appError('NOT_FOUND', '作品不存在');
    if (work.isFree) throw appError('PAYMENT_REQUIRED', '免费作品无需购买');

    // 已购 / 已下载 → 直接返回 access
    const [paidOrder, dl] = await Promise.all([
      prisma.order.findFirst({ where: { workId, buyerId: userId, payStatus: 'PAID' } }),
      prisma.download.findUnique({ where: { workId_userId: { workId, userId } } }),
    ]);
    if (paidOrder || dl) {
      return {
        orderId: paidOrder?.id ?? '',
        pay: { provider: 'mock', paid: true } as PayParams,
        access: true,
      };
    }

    // 复用 PENDING 订单
    const pending = await prisma.order.findFirst({
      where: { workId, buyerId: userId, payStatus: 'PENDING' },
    });
    if (pending) {
      const pay = await getProvider(payMethod).createOrder({
        id: pending.id,
        amount: Number(pending.amount),
        payMethod,
      });
      return { orderId: pending.id, pay };
    }

    const { platformFee, creatorAmount } = splitFee(Number(work.price));
    const order = await prisma.order.create({
      data: {
        workId,
        buyerId: userId,
        amount: work.price,
        platformFee,
        creatorAmount,
        payMethod,
        payStatus: 'PENDING',
        expiresAt: new Date(Date.now() + ORDER_TIMEOUT_MIN * 60_000),
      },
    });

    const pay = await getProvider(payMethod).createOrder({
      id: order.id,
      amount: Number(order.amount),
      payMethod,
    });

    // mock 立即支付成功（§10.6）
    if (pay.provider === 'mock') {
      await this.markPaid(order.id, `mock-${order.id}`, `mock-${order.id}`);
    }

    return { orderId: order.id, pay };
  },

  /** 二次发起支付（owner） */
  async pay(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw appError('NOT_FOUND', '订单不存在');
    if (order.buyerId !== userId) throw appError('FORBIDDEN', '无权操作他人订单');
    if (order.payStatus === 'PAID') return { pay: { provider: 'mock', paid: true } as PayParams };
    if (order.payStatus === 'CLOSED') throw appError('ORDER_CLOSED', '订单已关闭');
    if (order.expiresAt && order.expiresAt < new Date()) {
      await prisma.order.update({ where: { id: orderId }, data: { payStatus: 'CLOSED' } });
      throw appError('ORDER_CLOSED', '订单已过期');
    }
    const pay = await getProvider(order.payMethod).createOrder({
      id: order.id,
      amount: Number(order.amount),
      payMethod: order.payMethod,
    });
    if (pay.provider === 'mock') {
      await this.markPaid(order.id, `mock-${order.id}`, `mock-${order.id}`);
    }
    return { pay };
  },

  /** 查单（owner） */
  async get(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw appError('NOT_FOUND', '订单不存在');
    if (order.buyerId !== userId) throw appError('FORBIDDEN', '无权查看他人订单');
    return toOrder(order);
  },

  /**
   * 支付成功事务（§8.2，幂等）：
   * 订单 PAID → Download → CreatorIncome(PENDING) → Wallet.pending+ → Work.downloads+ → 通知买家。
   */
  async markPaid(orderId: string, transactionId: string, idempotencyKey: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw appError('NOT_FOUND', '订单不存在');
      if (order.payStatus === 'PAID') return { ok: true, already: true }; // 幂等

      if (order.payStatus === 'CLOSED') throw appError('ORDER_CLOSED', '订单已关闭');

      await tx.order.update({
        where: { id: orderId },
        data: { payStatus: 'PAID', paidAt: new Date(), transactionId, idempotencyKey },
      });

      // 下载权限
      await tx.download.upsert({
        where: { workId_userId: { workId: order.workId, userId: order.buyerId } },
        update: {},
        create: { workId: order.workId, userId: order.buyerId, orderId },
      });

      // 收益流水（不重复）
      const work = await tx.work.findUnique({ where: { id: order.workId } });
      const creator = work
        ? await tx.creatorProfile.findUnique({ where: { userId: work.authorId } })
        : null;
      if (creator) {
        await tx.creatorIncome.create({
          data: {
            creatorId: creator.id,
            orderId,
            amount: order.creatorAmount,
            status: 'PENDING',
            settleAt: settleAt(new Date()),
          },
        });
        await tx.wallet.update({
          where: { creatorId: creator.id },
          data: { pending: { increment: order.creatorAmount } },
        });
      }

      // 作品下载数 +1（购买计下载）
      await tx.work.update({ where: { id: order.workId }, data: { downloads: { increment: 1 } } });

      // 通知买家
      await tx.notification.create({
        data: {
          userId: order.buyerId,
          type: 'ARRIVED',
          text: work
            ? `你购买的《${work.title}》已到账，可在"我的资料"中查看。`
            : '你的作品已到账。',
          link: `/work/${order.workId}`,
        },
      });

      return { ok: true, already: false };
    });
  },

  /** 下载（登录 + hasAccess，幂等） */
  async download(userId: string, workId: string) {
    const work = await prisma.work.findFirst({
      where: { id: workId, deletedAt: null, status: 'PUBLISHED' },
    });
    if (!work) throw appError('NOT_FOUND', '作品不存在');

    const [dl, order] = await Promise.all([
      prisma.download.findUnique({ where: { workId_userId: { workId, userId } } }),
      prisma.order.findFirst({ where: { workId, buyerId: userId, payStatus: 'PAID' } }),
    ]);
    if (!work.isFree && !dl && !order) throw appError('PAYMENT_REQUIRED', '该作品需付费后才能下载');

    // 幂等写 Download；免费首次下载计数
    if (!dl) {
      await prisma.download.create({ data: { workId, userId } });
      if (work.isFree) {
        await prisma.work.update({ where: { id: workId }, data: { downloads: { increment: 1 } } });
      }
    }

    const url = await presignGet(work.fileKey, work.title);
    return { url, expiresIn: 600 };
  },
};
