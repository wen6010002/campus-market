import { prisma } from '../db';
import { appError } from '../lib/errors';
import { sanitize } from '../lib/sanitize';
import { cacheGet, cacheSet, cacheDel, cacheDelByPattern, meKey } from '../lib/cache';
import type { AnnounceInput, AnnounceQuery } from '@/lib/zod/announce';

// 公告服务（V4）：发布/撤回/已读/未读计数。
// 弹窗语义：关闭弹窗 = markAllRead（当前所有未发布公告写入 AnnouncementRead），
// 下次登录仅在有新公告时再弹。
// 性能（V4.1）：公共列表 60s 缓存；unread 分支按用户过滤不缓存；发布/撤回时失效列表 + 全体 me 缓存。
export const announceService = {
  /** 公告列表（公开；带 userId 时支持 unread 过滤） */
  async list(q: AnnounceQuery, userId?: string | null) {
    const unreadMode = !!(q.unread && userId);
    const cacheKey = `announcements:list:${q.page}:${q.pageSize}`;
    if (!unreadMode) {
      const cached = await cacheGet<Awaited<ReturnType<typeof queryList>>>(cacheKey);
      if (cached) return cached;
    }

    const result = await queryList(q, unreadMode ? userId : null);
    if (!unreadMode) await cacheSet(cacheKey, result, 60);
    return result;
  },

  /** 发布（管理员） */
  async publish(adminId: string, input: AnnounceInput) {
    const created = await prisma.announcement.create({
      data: {
        title: input.title,
        content: sanitize(input.content),
        level: input.level,
        authorId: adminId,
      },
      include: { author: { select: { id: true, username: true } } },
    });
    await invalidateAnnounceCaches();
    return {
      id: created.id,
      title: created.title,
      content: created.content,
      level: created.level,
      author: created.author,
      publishedAt: created.publishedAt.toISOString(),
    };
  },

  /** 撤回（软删，已读记录保留） */
  async unpublish(id: string) {
    const ann = await prisma.announcement.findFirst({ where: { id, deletedAt: null } });
    if (!ann) throw appError('NOT_FOUND', '公告不存在');
    await prisma.announcement.update({ where: { id }, data: { deletedAt: new Date() } });
    await invalidateAnnounceCaches();
    return { ok: true };
  },

  /** 管理列表（含已撤回） */
  async adminList(page: number, pageSize: number) {
    const [total, items] = await Promise.all([
      prisma.announcement.count(),
      prisma.announcement.findMany({
        include: { author: { select: { id: true, username: true } } },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      data: items.map((a) => ({
        id: a.id,
        title: a.title,
        level: a.level,
        author: a.author,
        publishedAt: a.publishedAt.toISOString(),
        deletedAt: a.deletedAt?.toISOString() ?? null,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  /** 全部标记已读（当前未读且未撤回的公告） */
  async markAllRead(userId: string) {
    const unreadIds = await prisma.announcement.findMany({
      where: { deletedAt: null, reads: { none: { userId } } },
      select: { id: true },
    });
    if (!unreadIds.length) return { read: 0 };
    await prisma.announcementRead.createMany({
      data: unreadIds.map((a) => ({ userId, announcementId: a.id })),
      skipDuplicates: true,
    });
    await cacheDel(meKey(userId)); // 顶栏红点即时清零
    return { read: unreadIds.length };
  },

  /** 未读数（published 总数 − 已读数，均不含已撤回） */
  async unreadCount(userId: string) {
    const [published, read] = await Promise.all([
      prisma.announcement.count({ where: { deletedAt: null } }),
      prisma.announcementRead.count({
        where: { userId, announcement: { deletedAt: null } },
      }),
    ]);
    return Math.max(published - read, 0);
  },
};

/** 列表查询本体（cacheGet 的类型来源） */
async function queryList(q: AnnounceQuery, userId: string | null) {
  const where: any = { deletedAt: null };
  if (userId) {
    where.reads = { none: { userId } };
  }

  const [total, items] = await Promise.all([
    prisma.announcement.count({ where }),
    prisma.announcement.findMany({
      where,
      include: { author: { select: { id: true, username: true } } },
      orderBy: { publishedAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return {
    data: items.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      level: a.level,
      author: a.author,
      publishedAt: a.publishedAt.toISOString(),
    })),
    pagination: {
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
    },
  };
}

/** 发布/撤回后：列表缓存 + 全体用户的 me 缓存（未读数变化） */
async function invalidateAnnounceCaches() {
  await cacheDelByPattern('announcements:list:*');
  await cacheDelByPattern('me:*');
}
