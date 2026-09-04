import { prisma } from '../db';
import { appError } from '../lib/errors';
import { logger } from '../lib/logger';
import { cacheSetNx } from '../lib/cache';
import { presignGet } from '../storage/minio';
import { getProvider } from '../payment';
import type { PayParams } from '../payment';
import { splitFee, settleAt } from '../algos/income';
import { achievementService } from './achievement.service';
import { EXT } from './upload.service';
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
        title: work.title,
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
      title: work.title,
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
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { work: { select: { title: true } } },
    });
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
      title: order.work.title,
      payMethod: order.payMethod,
    });
    // 重新拉起支付顺带续期，防止「支付中订单被 order-timeout 关掉 → 回调被拒 → 钱收了权限不给」
    if (pay.provider !== 'mock') {
      await prisma.order.update({
        where: { id: orderId },
        data: { expiresAt: new Date(Date.now() + ORDER_TIMEOUT_MIN * 60_000) },
      });
    }
    if (pay.provider === 'mock') {
      await this.markPaid(order.id, `mock-${order.id}`, `mock-${order.id}`);
    }
    return { pay };
  },

  /** 查单（owner）。PENDING 且非 mock 时兜底向网关查单（每 10s 一次，notify 丢失自愈） */
  async get(orderId: string, userId: string) {
    let order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw appError('NOT_FOUND', '订单不存在');
    if (order.buyerId !== userId) throw appError('FORBIDDEN', '无权查看他人订单');

    if (order.payStatus === 'PENDING' && order.payMethod !== 'MOCK') {
      const got = await cacheSetNx(`payq:${orderId}`, 10);
      if (got) {
        try {
          const r = await getProvider(order.payMethod).queryOrder(order.id);
          if (r.status === 'PAID') {
            await this.markPaid(order.id, r.tradeNo ?? order.id, `epay:${r.tradeNo ?? order.id}`);
            order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
          }
        } catch (e) {
          logger.warn({ err: e, orderId }, 'pay fallback query failed'); // 查单失败不阻塞读
        }
      }
    }
    return toOrder(order);
  },

  /**
   * 支付成功事务（§8.2，幂等）：
   * 订单 PAID → Download → CreatorIncome(PENDING) → Wallet.pending+ → Work.downloads+ → 通知买家。
   * V6 加固：金额校验（回调 money 与订单 amount 比对）；CLOSED 订单在已验签+金额相符的
   * 回调路径允许重开结算（买家在超时关单后才完成付款时，钱不能白收）。
   */
  async markPaid(
    orderId: string,
    transactionId: string,
    idempotencyKey: string,
    opts?: { paidAmount?: string },
  ) {
    let creatorUserId: string | undefined;
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw appError('NOT_FOUND', '订单不存在');
      if (order.payStatus === 'PAID') {
        // 幂等：但不同流水 = 买家可能付了两笔（旧支付页也付了），需人工在商户后台退
        if (order.transactionId && order.transactionId !== transactionId) {
          logger.error(
            { orderId, paid: order.transactionId, incoming: transactionId },
            '同订单收到两笔不同流水，疑似重复支付，需人工退款',
          );
        }
        return { ok: true, already: true };
      }

      // 纵深防御：回调金额与订单不符（伪造/错单）拒绝，500 不 ack 让平台重试直至放弃
      if (opts?.paidAmount && Math.abs(Number(opts.paidAmount) - Number(order.amount)) >= 0.005) {
        throw appError(
          'FORBIDDEN',
          `回调金额不符: notify=${opts.paidAmount} order=${order.amount}`,
        );
      }
      // 已退款订单不重新结算（退款后迟到的回调视为重复支付，人工处理）
      if (order.payStatus === 'REFUNDED') {
        logger.error(
          { orderId, incoming: transactionId },
          'REFUNDED 订单收到支付回调，疑似重复支付，需人工退款',
        );
        return { ok: true, already: true };
      }
      // CLOSED 不再拒绝：调用方已验签 + 金额校验，买家可能是关单后才完成付款（钱不能白收）

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
      creatorUserId = work?.authorId;
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
        // upsert 自愈：V3「开放发布」ensurePublisher 建档的创作者可能没有钱包行，update 会炸整个结算事务
        await tx.wallet.upsert({
          where: { creatorId: creator.id },
          update: { pending: { increment: order.creatorAmount } },
          create: {
            creatorId: creator.id,
            balance: 0,
            pending: order.creatorAmount,
            withdrawn: 0,
          },
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
    // 成就：首次收益（事务后触发）
    if (!result.already && creatorUserId) {
      await achievementService.grant(creatorUserId, 'FIRST_INCOME');
    }
    return result;
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

    const url = await presignGet(work.fileKey, `${work.title}.${EXT[work.fileType]}`);
    return { url, expiresIn: 600 };
  },

  /** 退款（V2-1）：自助退款（未下载+24h）/ 平台退款（管理员，任何已购可退） */
  async refund(orderId: string, userId: string, opts: { reason?: string; isAdmin?: boolean }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { work: { select: { title: true } } },
    });
    if (!order) throw appError('NOT_FOUND', '订单不存在');
    if (!opts.isAdmin && order.buyerId !== userId) throw appError('FORBIDDEN', '无权退款他人订单');
    if (order.payStatus !== 'PAID') throw appError('ORDER_CLOSED', '订单未支付，无需退款');

    // 自助退款：未下载 + 24h 内
    if (!opts.isAdmin) {
      const downloaded = await prisma.download.findUnique({
        where: { workId_userId: { workId: order.workId, userId: order.buyerId } },
      });
      const within24h = order.paidAt && Date.now() - order.paidAt.getTime() < 24 * 3600_000;
      if (downloaded || !within24h) {
        throw appError('REFUND_NOT_ALLOWED', '已下载或超过 24 小时，不可自助退款');
      }
    }

    // 调 provider 退款
    await getProvider(order.payMethod).refund({
      orderId: order.id,
      transactionId: order.transactionId ?? '',
      amount: Number(order.amount),
      reason: opts.reason,
    });

    // 事务：订单 REFUNDED + 撤销下载权 + 冲减收益 + 通知买家
    return prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { payStatus: 'REFUNDED', refundedAt: new Date() },
      });
      await tx.download.deleteMany({ where: { workId: order.workId, userId: order.buyerId } });

      const income = await tx.creatorIncome.findUnique({ where: { orderId } });
      if (income) {
        if (income.status === 'PENDING') {
          await tx.wallet.update({
            where: { creatorId: income.creatorId },
            data: { pending: { decrement: income.amount } },
          });
        } else if (income.status === 'SETTLED') {
          await tx.wallet.update({
            where: { creatorId: income.creatorId },
            data: { balance: { decrement: income.amount } },
          });
        }
        await tx.creatorIncome.update({ where: { id: income.id }, data: { status: 'WITHDRAWN' } });
      }

      await tx.notification.create({
        data: {
          userId: order.buyerId,
          type: 'SYSTEM',
          text: `你的订单《${order.work.title}》已退款。`,
          link: `/work/${order.workId}`,
        },
      });
      return { ok: true };
    });
  },
};
