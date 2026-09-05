import { prisma } from '../db';
import { appError } from '../lib/errors';
import { cacheDel, userStatusKey, meKey, cacheDelByPattern } from '../lib/cache';
import type { Role } from '@/lib/constants';
import { hashPassword } from '../auth/password';
import { workService } from './work.service';

/** 用户状态/聚合缓存失效：封禁拦截（requireUser）与 /auth/me 都要立即看到变化 */
async function invalidateUserCaches(userId: string) {
  await cacheDel(userStatusKey(userId));
  await cacheDel(meKey(userId));
}

const SAFE_SELECT = {
  id: true,
  username: true,
  email: true,
  role: true,
  status: true,
  avatarColor: true,
  avatarKey: true,
  bannedAt: true,
  bannedReason: true,
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
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status: 'BANNED', bannedAt: new Date(), bannedReason: reason ?? null },
    });
    await invalidateUserCaches(userId);
    return updated;
  },

  /** 解封 */
  async unbanUser(userId: string) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE', bannedAt: null, bannedReason: null },
    });
    await invalidateUserCaches(userId);
    return updated;
  },

  /** 改角色 */
  async setRole(userId: string, role: Role) {
    const updated = await prisma.user.update({ where: { id: userId }, data: { role } });
    await invalidateUserCaches(userId);
    return updated;
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

  /** 用户详情聚合（/ops/users/:id，V4） */
  async getUserDetail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        student: true,
        creator: { include: { wallet: true } },
        _count: { select: { works: true, orders: true, favorites: true, reports: true } },
      },
    });
    if (!user) throw appError('NOT_FOUND', '用户不存在');
    const {
      passwordHash: _ph,
      passwordPepper: _pp,
      ...safe
    } = user as typeof user & { passwordHash?: string; passwordPepper?: string };
    return {
      ...safe,
      walletBalance: user.creator?.wallet?.balance.toFixed(2) ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      bannedAt: user.bannedAt?.toISOString() ?? null,
    };
  },

  /** 全量作品管理列表（/ops/works，V4）——直查不走缓存，保证删除/下架实时可见 */
  async listWorks(opts: {
    page: number;
    pageSize: number;
    q?: string;
    status?: string;
    authorId?: string;
    category?: string;
    fine?: 'true' | 'false';
  }) {
    const where: any = { deletedAt: null };
    if (opts.q) where.title = { contains: opts.q, mode: 'insensitive' };
    if (opts.status) where.status = opts.status;
    if (opts.authorId) where.authorId = opts.authorId;
    if (opts.category) where.category = opts.category;
    if (opts.fine) where.isFree = opts.fine !== 'true';

    const [total, works] = await Promise.all([
      prisma.work.count({ where }),
      prisma.work.findMany({
        where,
        select: {
          id: true,
          title: true,
          course: true,
          coverIcon: true,
          category: true,
          isFree: true,
          price: true,
          status: true,
          quality: true,
          downloads: true,
          favs: true,
          views: true,
          createdAt: true,
          publishedAt: true,
          deletedAt: true,
          author: { select: { id: true, username: true, avatarColor: true, avatarKey: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
    ]);
    return {
      data: works.map((w) => ({
        ...w,
        price: w.price.toFixed(2),
        createdAt: w.createdAt.toISOString(),
        publishedAt: w.publishedAt?.toISOString() ?? null,
      })),
      pagination: {
        page: opts.page,
        pageSize: opts.pageSize,
        total,
        totalPages: Math.ceil(total / opts.pageSize),
      },
    };
  },

  /** 订单管理列表（/ops/orders，V4） */
  async listOrders(opts: { page: number; pageSize: number; payStatus?: string; q?: string }) {
    const where: any = {};
    if (opts.payStatus) where.payStatus = opts.payStatus;
    if (opts.q) {
      where.OR = [
        { id: { contains: opts.q } },
        { work: { title: { contains: opts.q, mode: 'insensitive' } } },
        { buyer: { username: { contains: opts.q, mode: 'insensitive' } } },
      ];
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        select: {
          id: true,
          amount: true,
          platformFee: true,
          creatorAmount: true,
          payMethod: true,
          payStatus: true,
          transactionId: true,
          paidAt: true,
          createdAt: true,
          work: { select: { id: true, title: true } },
          buyer: { select: { id: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
    ]);
    return {
      data: orders.map((o) => ({
        ...o,
        amount: o.amount.toFixed(2),
        platformFee: o.platformFee.toFixed(2),
        creatorAmount: o.creatorAmount.toFixed(2),
        paidAt: o.paidAt?.toISOString() ?? null,
        createdAt: o.createdAt.toISOString(),
      })),
      pagination: {
        page: opts.page,
        pageSize: opts.pageSize,
        total,
        totalPages: Math.ceil(total / opts.pageSize),
      },
    };
  },

  /** 资料管理（P0）：单条调整——分区（精品/普通=自我提升区/校园专区）、分类、上下架 */
  async updateWork(
    adminId: string,
    id: string,
    input: { isFree?: boolean; category?: string; status?: 'PUBLISHED' | 'TAKEN_DOWN' },
  ) {
    const work = await prisma.work.findFirst({ where: { id, deletedAt: null } });
    if (!work) throw appError('NOT_FOUND', '资料不存在');
    const data: Record<string, unknown> = {};
    if (input.isFree !== undefined) {
      // V7 免费模式：isFree 仅决定展示分区（false=自我提升区精品位），价格仅作数据保留
      data.isFree = input.isFree;
      data.price = input.isFree ? work.price || 9.9 : 0;
    }
    if (input.category) data.category = input.category;
    if (input.status) {
      data.status = input.status;
      if (input.status === 'PUBLISHED' && !work.publishedAt) data.publishedAt = new Date();
    }
    const updated = await prisma.work.update({ where: { id }, data });
    await prisma.auditLog.create({
      data: {
        workId: id,
        action:
          input.status === 'PUBLISHED'
            ? 'APPROVE'
            : input.status === 'TAKEN_DOWN'
              ? 'TAKE_DOWN'
              : 'REQUEST_CHANGES',
        reviewerId: adminId,
        note: `资料管理调整：${[
          input.isFree !== undefined ? `分区→${input.isFree ? '普通' : '精品'}` : null,
          input.category ? `分类→${input.category}` : null,
          input.status ? `状态→${input.status}` : null,
        ]
          .filter(Boolean)
          .join('，')}`,
      },
    });
    await cacheDelByPattern('works:list:*');
    // 上架时补全发布副作用（通知/动态/成就）走既有审核通道，避免旁路
    if (input.status === 'PUBLISHED' && work.status !== 'PUBLISHED') {
      await workService.adminAudit(id, 'APPROVE', undefined, adminId);
    }
    return {
      id: updated.id,
      isFree: updated.isFree,
      category: updated.category,
      status: updated.status,
    };
  },

  /** 资料管理（P0）：批量操作——上线（可选分区）/下架/调分区/删除 */
  async batchWorks(
    adminId: string,
    ids: string[],
    action: 'publish' | 'takeDown' | 'setFine' | 'setFree' | 'delete',
  ) {
    let done = 0;
    const errors: string[] = [];
    for (const id of ids) {
      try {
        if (action === 'delete') {
          await workService.remove(id, adminId, true);
        } else if (action === 'publish') {
          await this.updateWork(adminId, id, { status: 'PUBLISHED' });
        } else if (action === 'takeDown') {
          await this.updateWork(adminId, id, { status: 'TAKEN_DOWN' });
        } else if (action === 'setFine') {
          await this.updateWork(adminId, id, { isFree: false });
        } else {
          await this.updateWork(adminId, id, { isFree: true });
        }
        done++;
      } catch (e) {
        errors.push(`${id}: ${e instanceof Error ? e.message : '失败'}`);
      }
    }
    await cacheDelByPattern('works:list:*');
    return { done, total: ids.length, errors: errors.slice(0, 5) };
  },
};
