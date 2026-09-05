import { prisma } from '../db';
import { appError } from '../lib/errors';
import { redis } from '../lib/redis';
import { cacheGet, cacheSet, cacheDel, cacheDelByPattern } from '../lib/cache';
import { enforceRateLimit } from '../lib/ratelimit';
import { paymentsEnabled } from '../lib/payments';
import { headObject, presignGet, presignGetInline, getObjectText } from '../storage/minio';
import { notifyService } from './notify.service';
import { achievementService } from './achievement.service';
import { EXT } from './upload.service';
import type { WorkInput, WorkQuery } from '@/lib/zod/work';
import { WorkStatus, Quality } from '@/lib/constants';

// Decimal → 字符串（金额 2 位 / 评分 1 位，契约 §0.2）
const money = (d: { toFixed(n: number): string } | null): string | null =>
  d === null ? null : d.toFixed(2);
const ratingStr = (d: { toFixed(n: number): string }): string => d.toFixed(1);

const WORK_LIST_INCLUDE = {
  author: { include: { creator: true, student: true } },
  tags: { include: { tag: true } },
};

function toListItem(
  w: any,
  viewerId?: string,
  badge?: { key: string; title: string; rarity: string; symbol: string } | null,
) {
  return {
    id: w.id,
    title: w.title,
    description: w.description,
    course: w.course,
    fileType: w.fileType,
    fileSize: w.fileSize,
    pages: w.pages,
    coverIcon: w.coverIcon,
    coverTheme: w.coverTheme,
    hasCover: !!w.coverKey,
    category: w.category,
    isFree: w.isFree,
    price: money(w.price)!,
    oldPrice: money(w.oldPrice),
    quality: w.quality,
    status: w.status,
    rating: ratingStr(w.rating),
    ratingCount: w.ratingCount,
    downloads: w.downloads,
    favs: w.favs,
    likes: w.likes,
    views: w.views,
    tags: w.tags.map((t: any) => t.tag.name),
    author: {
      id: w.author.id,
      username: w.author.username,
      avatarColor: w.author.avatarColor,
      hasAvatar: !!w.author.avatarKey,
      avatarVer: w.author.updatedAt.getTime(),
      verified: w.author.creator?.verified ?? false,
      badge: badge ?? null, // V8 佩戴勋章（作品卡作者名旁）
    },
    publishedAt: w.publishedAt?.toISOString() ?? null,
    updatedAt: w.updatedAt.toISOString(),
  };
}

const SORT_MAP = {
  complex: [{ quality: 'desc' as const }, { publishedAt: 'desc' as const }],
  hot: [{ downloads: 'desc' as const }],
  rate: [{ rating: 'desc' as const }, { ratingCount: 'desc' as const }],
  new: [{ publishedAt: 'desc' as const }],
  price: [{ isFree: 'desc' as const }, { price: 'asc' as const }],
};

/** 作品写操作后失效列表/详情缓存 */
async function invalidateWorkCaches(workId?: string) {
  await cacheDelByPattern('works:list:*');
  if (workId) await cacheDel(`work:detail:${workId}`);
}

export const workService = {
  /** 列表（公开，仅 PUBLISHED） */
  async list(q: WorkQuery) {
    const cacheKey = `works:list:${JSON.stringify(q)}`;
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    const where: any = { status: 'PUBLISHED', deletedAt: null };
    if (q.creatorId) where.authorId = q.creatorId;
    if (q.isFree !== undefined) where.isFree = q.isFree;
    if (q.quality) where.quality = q.quality;
    if (q.fileType) where.fileType = q.fileType;
    if (q.minRating !== undefined) where.rating = { gte: q.minRating };
    if (q.course) where.course = { contains: q.course };
    if (q.updatedSince) where.updatedAt = { gte: new Date(q.updatedSince) };
    if (q.tag) where.tags = { some: { tag: { name: q.tag } } };
    if (q.category || q.excludeCat) {
      where.category = {};
      if (q.category) where.category.equals = q.category;
      if (q.excludeCat) where.category.not = q.excludeCat;
    }

    const [total, works] = await Promise.all([
      prisma.work.count({ where }),
      prisma.work.findMany({
        where,
        include: WORK_LIST_INCLUDE,
        orderBy: SORT_MAP[q.sort] ?? SORT_MAP.complex,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);

    const totalPages = Math.ceil(total / q.pageSize);
    // V8：批量回填作者佩戴勋章（作品卡作者名旁）
    const badges = await achievementService.inlineBadges(works.map((w) => w.authorId));
    const result = {
      data: works.map((w) => toListItem(w, undefined, badges[w.authorId])),
      pagination: { page: q.page, pageSize: q.pageSize, total, totalPages },
    };
    await cacheSet(cacheKey, result, 30);
    return result;
  },

  /** 分类页二级维度：某大类下的热门课程聚合（V3-2） */
  async courses(category?: string) {
    const cacheKey = `works:courses:${category ?? 'all'}`;
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;
    const grouped = await prisma.work.groupBy({
      by: ['course'],
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        ...(category ? { category: category as any } : {}),
      },
      _count: { course: true },
      orderBy: { _count: { course: 'desc' } },
      take: 10,
    });
    const result = grouped.map((g) => ({ course: g.course, count: g._count.course }));
    await cacheSet(cacheKey, result, 60);
    return result;
  },

  /** 详情（公开；带会话时回填 myFav/myAccess/myRating；管理员可查看非 PUBLISHED 用于审核）
   *  V3-4 起浏览计数不再在详情读取时发生：views = 预览打开次数（POST /works/:id/preview 内去重计数）。 */
  async get(id: string, viewerId?: string, viewerRole?: string) {
    const cacheKey = `work:detail:${id}`;
    if (!viewerId) {
      const cached = await cacheGet(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const work = await prisma.work.findFirst({
      where: { id, deletedAt: null },
      include: WORK_LIST_INCLUDE,
    });
    if (
      !work ||
      (work.status !== 'PUBLISHED' && work.authorId !== viewerId && viewerRole !== 'ADMIN')
    ) {
      throw appError('NOT_FOUND', '作品不存在');
    }

    const [item, authorBadge] = await Promise.all([
      Promise.resolve(toListItem(work)),
      achievementService.inlineBadges([work.authorId]).then((m) => m[work.authorId] ?? null),
    ]);
    let myFav = false;
    let myLiked = false; // V8 点赞态（详情页按钮）
    let myAccess = work.isFree || !paymentsEnabled(); // V7 全站免费：付费开关关闭时人人可看
    let myRating: { stars: number; text: string } | null = null;
    if (viewerId) {
      const [fav, liked, access, rating] = await Promise.all([
        prisma.favorite.findUnique({ where: { userId_workId: { userId: viewerId, workId: id } } }),
        prisma.like.findUnique({ where: { userId_workId: { userId: viewerId, workId: id } } }),
        work.isFree
          ? Promise.resolve(true)
          : prisma.$transaction([
              prisma.order.findFirst({
                where: { workId: id, buyerId: viewerId, payStatus: 'PAID' },
              }),
              prisma.download.findUnique({
                where: { workId_userId: { workId: id, userId: viewerId } },
              }),
            ]),
        prisma.workRating.findUnique({
          where: { workId_userId: { workId: id, userId: viewerId } },
        }),
      ]);
      myFav = !!fav;
      myLiked = !!liked;
      myAccess =
        work.isFree ||
        !paymentsEnabled() ||
        !!(Array.isArray(access) ? access[0] || access[1] : access);
      myRating = rating ? { stars: rating.stars, text: rating.text } : null;
    }

    const author = work.author;
    const authorWorks = await prisma.work.count({
      where: { authorId: author.id, status: 'PUBLISHED', deletedAt: null },
    });

    const result = {
      ...item,
      previewToc: (work.previewToc as string[]) ?? [],
      applyMajor: work.applyMajor,
      applyGrade: work.applyGrade,
      applyCrowd: work.applyCrowd,
      ratingDist: work.ratingDist as Record<string, number>,
      hasSample: !work.isFree && !!work.previewKey && paymentsEnabled(),
      previewOnly: !work.isFree && !myAccess,
      myRating,
      myFav,
      myLiked,
      myAccess,
      author: {
        ...item.author,
        badge: authorBadge, // V8 佩戴勋章（详情页信任卡）
        id: author.id,
        username: author.username,
        avatarColor: author.avatarColor,
        hasAvatar: !!author.avatarKey,
        avatarVer: author.updatedAt.getTime(),
        bio: author.creator?.bio ?? '',
        direction: author.creator?.direction ?? '',
        honor: author.creator?.honor ?? null,
        college: author.student?.college ?? '',
        major: author.student?.major ?? '',
        verified: author.creator?.verified ?? false,
        helped: await prisma.work
          .aggregate({ where: { authorId: author.id }, _sum: { downloads: true } })
          .then((r) => r._sum.downloads ?? 0),
        fans: await prisma.follow.count({ where: { followingId: author.id } }),
        works: authorWorks,
        rate: ratingStr(
          await prisma.work
            .aggregate({
              where: { authorId: author.id, ratingCount: { gt: 0 } },
              _avg: { rating: true },
            })
            .then((r) => r._avg.rating ?? 0),
        ),
      },
    };
    if (!viewerId) await cacheSet(cacheKey, result, 60);
    return result;
  },

  /** 创建（CREATOR，DRAFT） */
  async create(authorId: string, input: WorkInput) {
    if (!input.copyrightAccepted) throw appError('COPYRIGHT_REQUIRED', '请勾选原创/授权声明');

    // 文件指纹去重：防购买后转卖重复上架
    if (input.fileSha) {
      const dup = await prisma.work.findFirst({
        where: { fileSha: input.fileSha, deletedAt: null },
      });
      if (dup) throw appError('CONFLICT', '该文件已在平台，请勿重复上架');
    }

    const work = await prisma.work.create({
      data: {
        authorId,
        title: input.title,
        description: input.description,
        course: input.course,
        fileType: input.fileType,
        fileKey: input.fileKey,
        fileSha: input.fileSha ?? null,
        fileSize: input.fileSize,
        pages: input.pages ?? 0,
        coverIcon: input.coverIcon ?? '📄',
        coverTheme: input.coverTheme ?? 'g-default',
        coverKey: input.coverKey ?? null,
        previewKey: input.previewKey ?? null,
        category: input.category,
        isFree: input.isFree,
        price: input.isFree ? 0 : Number(input.price ?? 0),
        oldPrice: input.oldPrice ? Number(input.oldPrice) : null,
        status: 'DRAFT',
        quality: 'NORMAL',
        copyrightAccepted: true,
        isOriginal: input.isOriginal,
        applyMajor: input.applyMajor ?? null,
        applyGrade: input.applyGrade ?? null,
        applyCrowd: input.applyCrowd ?? null,
        previewToc: input.previewToc,
        tags: {
          create: input.tags.map((name) => ({
            tag: { connectOrCreate: { where: { name }, create: { name } } },
          })),
        },
      },
      include: WORK_LIST_INCLUDE,
    });
    await invalidateWorkCaches(work.id);
    return toListItem(work);
  },

  /** 更新（owner，仅 DRAFT/REJECTED） */
  async update(id: string, userId: string, input: WorkInput) {
    const work = await prisma.work.findFirst({ where: { id, deletedAt: null } });
    if (!work) throw appError('NOT_FOUND', '作品不存在');
    if (work.authorId !== userId) throw appError('FORBIDDEN', '无权修改他人作品');
    if (work.status !== 'DRAFT' && work.status !== 'REJECTED')
      throw appError('CONFLICT', '仅草稿/被驳回作品可修改');

    const updated = await prisma.work.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        course: input.course,
        fileType: input.fileType,
        fileKey: input.fileKey,
        fileSize: input.fileSize,
        pages: input.pages ?? 0,
        coverIcon: input.coverIcon,
        coverTheme: input.coverTheme,
        coverKey: input.coverKey ?? null,
        previewKey: input.previewKey ?? null,
        category: input.category,
        isFree: input.isFree,
        price: input.isFree ? 0 : Number(input.price ?? 0),
        oldPrice: input.oldPrice ? Number(input.oldPrice) : null,
        applyMajor: input.applyMajor ?? null,
        applyGrade: input.applyGrade ?? null,
        applyCrowd: input.applyCrowd ?? null,
        previewToc: input.previewToc,
        status: input.copyrightAccepted ? work.status : work.status,
      },
      include: WORK_LIST_INCLUDE,
    });
    await invalidateWorkCaches(id);
    return toListItem(updated);
  },

  /** 发布（owner，DRAFT/REJECTED → PENDING，校验文件已上传） */
  async publish(id: string, userId: string) {
    const work = await prisma.work.findFirst({ where: { id, deletedAt: null } });
    if (!work) throw appError('NOT_FOUND', '作品不存在');
    if (work.authorId !== userId) throw appError('FORBIDDEN', '无权操作');
    if (!work.copyrightAccepted) throw appError('COPYRIGHT_REQUIRED', '请勾选原创/授权声明');
    if (work.status !== 'DRAFT' && work.status !== 'REJECTED')
      throw appError('CONFLICT', '当前状态不可发布');

    // 校验文件确实上传
    try {
      await headObject(work.fileKey);
    } catch {
      throw appError('BAD_FILE', '文件未上传成功，请重新上传');
    }

    const updated = await prisma.work.update({
      where: { id },
      data: { status: 'PENDING' },
      include: WORK_LIST_INCLUDE,
    });
    await invalidateWorkCaches(id);
    return toListItem(updated);
  },

  /** 删除（owner/admin，软删；admin 删除留审计记录） */
  async remove(id: string, userId: string, isAdmin: boolean, reason?: string) {
    const work = await prisma.work.findFirst({ where: { id, deletedAt: null } });
    if (!work) throw appError('NOT_FOUND', '作品不存在');
    if (!isAdmin && work.authorId !== userId) throw appError('FORBIDDEN', '无权删除');
    await prisma.$transaction(async (tx) => {
      await tx.work.update({ where: { id }, data: { deletedAt: new Date() } });
      if (isAdmin) {
        await tx.auditLog.create({
          data: { workId: id, action: 'DELETE', reviewerId: userId, note: reason ?? null },
        });
      }
    });
    await invalidateWorkCaches(id);
    return { ok: true };
  },

  /** 按 id 集合取已上架作品（保持传入顺序；路线图关联资料用，V4） */
  async byIds(ids: string[]) {
    if (!ids.length) return [];
    const works = await prisma.work.findMany({
      where: { id: { in: ids }, status: 'PUBLISHED', deletedAt: null },
      include: WORK_LIST_INCLUDE,
    });
    const byId = new Map(works.map((w) => [w.id, w]));
    return ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((w) => toListItem(w));
  },

  /** 相关推荐（同作者/同标签，公开） */
  async related(id: string) {
    const work = await prisma.work.findUnique({ where: { id } });
    if (!work) throw appError('NOT_FOUND', '作品不存在');
    const tagNames = await prisma.workTag.findMany({
      where: { workId: id },
      select: { tag: { select: { name: true } } },
    });
    const tags = tagNames.map((t) => t.tag.name);
    const related = await prisma.work.findMany({
      where: {
        id: { not: id },
        status: 'PUBLISHED',
        deletedAt: null,
        OR: [{ authorId: work.authorId }, { tags: { some: { tag: { name: { in: tags } } } } }],
      },
      include: WORK_LIST_INCLUDE,
      orderBy: { downloads: 'desc' },
      take: 8,
    });
    const relBadges = await achievementService.inlineBadges(related.map((w) => w.authorId));
    return related.map((w) => toListItem(w, undefined, relBadges[w.authorId]));
  },

  /** 在线预览（V3-4，md 扩展）：PDF 签 inline URL 走 iframe；MD 由服务端直接回文本（前端 marked 渲染，避免跨域 fetch MinIO）。
   *  mode：free → full（原文件）；付费未购 → sample（previewKey 试读副本，无副本则 none）；已购/作者/ADMIN → full。
   *  PDF/MD 之外一律 none。观看口径：同人/同 IP 24h 去重，SETNX 成功才 INCR view:{id}（view-sync 定时回写）。 */
  async getPreview(id: string, viewerId: string | undefined, viewerIp: string) {
    await enforceRateLimit(`rl:preview:${viewerId ?? viewerIp}`, 30, 60_000);
    const work = await prisma.work.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        authorId: true,
        isFree: true,
        fileType: true,
        fileKey: true,
        previewKey: true,
        pages: true,
        status: true,
      },
    });
    if (!work || (work.status !== 'PUBLISHED' && work.authorId !== viewerId)) {
      throw appError('NOT_FOUND', '作品不存在');
    }
    if (work.fileType !== 'PDF' && work.fileType !== 'MD') {
      return {
        mode: 'none' as const,
        url: null,
        content: null,
        pages: work.pages,
        hasPreview: false,
      };
    }

    // V7 全站免费：付费开关关闭时付费作品也走完整预览（不再发试读副本）
    let myAccess = !paymentsEnabled() || work.isFree || work.authorId === viewerId;
    if (!myAccess && viewerId) {
      const [order, download] = await prisma.$transaction([
        prisma.order.findFirst({
          where: { workId: id, buyerId: viewerId, payStatus: 'PAID' },
          select: { id: true },
        }),
        prisma.download.findUnique({
          where: { workId_userId: { workId: id, userId: viewerId } },
          select: { id: true },
        }),
      ]);
      myAccess = !!(order || download);
    }

    let mode: 'full' | 'sample' | 'none';
    let key: string | null;
    if (myAccess) {
      mode = 'full';
      key = work.fileKey;
    } else if (work.previewKey) {
      mode = 'sample';
      key = work.previewKey;
    } else {
      mode = 'none';
      key = null;
    }

    // 观看计数：24h 去重（登录按用户，匿名按 IP）
    if (mode !== 'none') {
      const dedupKey = `viewd:${viewerId ? `u:${viewerId}` : `i:${viewerIp}`}:${id}`;
      const first = await redis.set(dedupKey, '1', 'EX', 86400, 'NX');
      if (first === 'OK') await redis.incr(`view:${id}`);
    }

    if (work.fileType === 'MD') {
      // md：服务端读文本直回（full=原文 / sample=试读副本），前端 marked+DOMPurify 渲染
      const content = key ? await getObjectText(key) : null;
      return { mode, url: null, content, pages: work.pages, hasPreview: mode !== 'none' };
    }
    const url = key ? await presignGetInline(key) : null;
    return { mode, url, content: null, pages: work.pages, hasPreview: mode !== 'none' };
  },

  /** 管理：待审核列表 */
  async adminPending() {
    const works = await prisma.work.findMany({
      where: { status: 'PENDING', deletedAt: null },
      include: WORK_LIST_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return works.map((w) => toListItem(w));
  },

  /** 管理：审核用下载（无视状态/购买门槛，仅预签名返回，不写 Download 记录、不计数） */
  async adminDownload(id: string) {
    const work = await prisma.work.findFirst({ where: { id, deletedAt: null } });
    if (!work) throw appError('NOT_FOUND', '作品不存在');
    const url = await presignGet(work.fileKey, `${work.title}.${EXT[work.fileType]}`);
    return { url, expiresIn: 600 };
  },

  /** 管理：审核（状态机 + AuditLog） */
  async adminAudit(
    id: string,
    action: 'APPROVE' | 'REJECT' | 'TAKE_DOWN' | 'REQUEST_CHANGES',
    note: string | undefined,
    adminId: string,
  ) {
    const work = await prisma.work.findFirst({ where: { id, deletedAt: null } });
    if (!work) throw appError('NOT_FOUND', '作品不存在');

    const next: Record<string, WorkStatus> = {
      APPROVE: 'PUBLISHED',
      REJECT: 'REJECTED',
      TAKE_DOWN: 'TAKEN_DOWN',
      REQUEST_CHANGES: 'REJECTED',
    };
    const target = next[action];
    if (!target) throw appError('VALIDATION', '无效的审核动作');

    const updated = await prisma.$transaction(async (tx) => {
      const w = await tx.work.update({
        where: { id },
        data: {
          status: target,
          publishedAt: action === 'APPROVE' ? new Date() : work.publishedAt,
          rejectedReason:
            action === 'REJECT' || action === 'REQUEST_CHANGES' ? (note ?? null) : null,
        },
      });
      await tx.auditLog.create({
        data: { workId: id, action: action as any, reviewerId: adminId, note },
      });
      return w;
    });

    // 上架：写 Dynamic(PUBLISH) + 通知粉丝；审核结果通知作者（V4：补 AUDIT_RESULT 缺口）
    if (action === 'APPROVE') {
      await notifyService.onWorkPublished(work.authorId, work.id, work.title);
      // V8 作品轴成就判定（首个过审/十作品）
      achievementService.checkWorks(work.authorId).catch(() => {});
      await notifyService.createNotification(
        work.authorId,
        'AUDIT_RESULT',
        `你的作品<b>${work.title}</b>已通过审核并上架`,
        `/work/${work.id}`,
      );
    } else if (action === 'REJECT' || action === 'REQUEST_CHANGES') {
      await notifyService.createNotification(
        work.authorId,
        'AUDIT_RESULT',
        `你的作品<b>${work.title}</b>未通过审核${note ? `：${note}` : ''}`,
        `/work/${work.id}`,
      );
    } else if (action === 'TAKE_DOWN') {
      await notifyService.createNotification(
        work.authorId,
        'AUDIT_RESULT',
        `你的作品<b>${work.title}</b>已被下架${note ? `：${note}` : ''}`,
        `/work/${work.id}`,
      );
    }

    await invalidateWorkCaches(id);
    return toListItem(
      await prisma.work.findUniqueOrThrow({
        where: { id: updated.id },
        include: WORK_LIST_INCLUDE,
      }),
    );
  },
};
