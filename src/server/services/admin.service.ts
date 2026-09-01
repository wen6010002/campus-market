import { prisma } from '../db';
import { appError } from '../lib/errors';
import type { Role } from '@/lib/constants';
import { hashPassword } from '../auth/password';

const SAFE_SELECT = {
  id: true,
  username: true,
  email: true,
  role: true,
  status: true,
  avatarColor: true,
  createdAt: true,
  lastLoginAt: true,
} as const;

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

  /** 用户列表（脱敏：不含 passwordHash/passwordPepper） */
  async listUsers(opts: {
    page: number;
    pageSize: number;
    q?: string;
    role?: string;
    status?: string;
  }) {
    const where: any = {};
    if (opts.q) {
      where.OR = [
        { username: { contains: opts.q, mode: 'insensitive' } },
        { email: { contains: opts.q, mode: 'insensitive' } },
      ];
    }
    if (opts.role) where.role = opts.role;
    if (opts.status) where.status = opts.status;

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: SAFE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
    ]);
    return {
      data: users,
      pagination: {
        page: opts.page,
        pageSize: opts.pageSize,
        total,
        totalPages: Math.ceil(total / opts.pageSize),
      },
    };
  },

  /** 封号 */
  async banUser(userId: string, reason?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw appError('NOT_FOUND', '用户不存在');
    if (user.role === 'ADMIN') throw appError('FORBIDDEN', '不能封禁管理员');
    return prisma.user.update({
      where: { id: userId },
      data: { status: 'BANNED', bannedAt: new Date(), bannedReason: reason ?? null },
    });
  },

  /** 解封 */
  async unbanUser(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE', bannedAt: null, bannedReason: null },
    });
  },

  /** 改角色 */
  async setRole(userId: string, role: Role) {
    return prisma.user.update({ where: { id: userId }, data: { role } });
  },

  /** 创建独立后台测试账号；仅现有管理员可通过路由调用。 */
  async createBackofficeTester(input: { email: string; username: string; password: string }) {
    const email = input.email.toLowerCase();
    const [emailTaken, usernameTaken] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      prisma.user.findUnique({ where: { username: input.username }, select: { id: true } }),
    ]);
    if (emailTaken) throw appError('EMAIL_TAKEN', '该测试邮箱已被使用');
    if (usernameTaken) throw appError('USERNAME_TAKEN', '该测试用户名已被使用');

    const user = await prisma.user.create({
      data: {
        email,
        username: input.username,
        passwordHash: await hashPassword(input.password),
        role: 'ADMIN',
        avatarColor: '#334155',
      },
      select: { id: true, email: true, username: true, role: true, createdAt: true },
    });
    return { ...user, createdAt: user.createdAt.toISOString() };
  },

  /** 提现审批列表（REQUESTED 优先） */
  async listPayouts() {
    const payouts = await prisma.payout.findMany({
      where: { status: 'REQUESTED' },
      include: { creator: { include: { user: { select: { username: true } } } } },
      orderBy: { requestedAt: 'asc' },
    });
    return payouts.map((p) => ({
      id: p.id,
      amount: p.amount.toFixed(2),
      method: p.method,
      status: p.status,
      creator: p.creator.user.username,
      requestedAt: p.requestedAt.toISOString(),
    }));
  },

  /** 待认证创作者列表 */
  async listPendingCreators() {
    const creators = await prisma.creatorProfile.findMany({
      where: { verified: false },
      include: { user: { select: { id: true, username: true, email: true } } },
      orderBy: { appliedAt: 'asc' },
    });
    return creators.map((c) => ({
      id: c.id,
      userId: c.user.id,
      username: c.user.username,
      email: c.user.email,
      bio: c.bio,
      direction: c.direction,
      honor: c.honor,
      appliedAt: c.appliedAt?.toISOString() ?? null,
    }));
  },

  /** 数据看板 */
  async stats() {
    const [users, works, orders, revenue, pendingWorks, pendingPayouts] = await Promise.all([
      prisma.user.count(),
      prisma.work.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
      prisma.order.count({ where: { payStatus: 'PAID' } }),
      prisma.order.aggregate({ where: { payStatus: 'PAID' }, _sum: { amount: true } }),
      prisma.work.count({ where: { status: 'PENDING', deletedAt: null } }),
      prisma.payout.count({ where: { status: 'REQUESTED' } }),
    ]);
    return {
      users,
      works,
      orders,
      revenue: (revenue._sum.amount ?? 0).toFixed(2),
      pendingWorks,
      pendingPayouts,
    };
  },
};
