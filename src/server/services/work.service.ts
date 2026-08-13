import { prisma } from '../db';
import { appError } from '../lib/errors';
import { headObject } from '../storage/minio';
import { notifyService } from './notify.service';
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

function toListItem(w: any, viewerId?: string) {
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
      verified: w.author.creator?.verified ?? false,
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

export const workService = {
  /** 列表（公开，仅 PUBLISHED） */
  async list(q: WorkQuery) {
    const where: any = { status: 'PUBLISHED', deletedAt: null };
    if (q.creatorId) where.authorId = q.creatorId;
    if (q.isFree !== undefined) where.isFree = q.isFree;
    if (q.quality) where.quality = q.quality;
    if (q.fileType) where.fileType = q.fileType;
    if (q.minRating !== undefined) where.rating = { gte: q.minRating };
    if (q.course) where.course = { contains: q.course };
    if (q.updatedSince) where.updatedAt = { gte: new Date(q.updatedSince) };
    if (q.tag) where.tags = { some: { tag: { name: q.tag } } };

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
    return {
      data: works.map((w) => toListItem(w)),
      pagination: { page: q.page, pageSize: q.pageSize, total, totalPages },
    };
  },

  /** 详情（公开；带会话时回填 myFav/myAccess/myRating） */
  async get(id: string, viewerId?: string) {
    const work = await prisma.work.findFirst({
      where: { id, deletedAt: null },
      include: WORK_LIST_INCLUDE,
    });
    if (!work || (work.status !== 'PUBLISHED' && work.authorId !== viewerId)) {
      throw appError('NOT_FOUND', '作品不存在');
    }

    // 浏览 +1
    await prisma.work.update({ where: { id }, data: { views: { increment: 1 } } });

    const item = toListItem(work);
    let myFav = false;
    let myAccess = work.isFree;
    let myRating: { stars: number; text: string } | null = null;
    if (viewerId) {
      const [fav, access, rating] = await Promise.all([
        prisma.favorite.findUnique({ where: { userId_workId: { userId: viewerId, workId: id } } }),
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
      myAccess = work.isFree || !!(Array.isArray(access) ? access[0] || access[1] : access);
      myRating = rating ? { stars: rating.stars, text: rating.text } : null;
    }

    const author = work.author;
    const authorWorks = await prisma.work.count({
      where: { authorId: author.id, status: 'PUBLISHED', deletedAt: null },
    });

    return {
      ...item,
      previewToc: (work.previewToc as string[]) ?? [],
      applyMajor: work.applyMajor,
      applyGrade: work.applyGrade,
      applyCrowd: work.applyCrowd,
      ratingDist: work.ratingDist as Record<string, number>,
      previewOnly: !work.isFree && !myAccess,
      myRating,
      myFav,
      myAccess,
      author: {
        id: author.id,
        username: author.username,
        avatarColor: author.avatarColor,
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
  },

  /** 创建（CREATOR，DRAFT） */
  async create(authorId: string, input: WorkInput) {
    if (!input.copyrightAccepted) throw appError('COPYRIGHT_REQUIRED', '请勾选原创/授权声明');

    const work = await prisma.work.create({
      data: {
        authorId,
        title: input.title,
        description: input.description,
        course: input.course,
        fileType: input.fileType,
        fileKey: input.fileKey,
        fileSize: input.fileSize,
        pages: input.pages ?? 0,
        coverIcon: input.coverIcon ?? '📄',
        coverTheme: input.coverTheme ?? 'g-default',
        isFree: input.isFree,
        price: input.isFree ? 0 : Number(input.price ?? 0),
        oldPrice: input.oldPrice ? Number(input.oldPrice) : null,
        status: 'DRAFT',
        quality: 'NORMAL',
        copyrightAccepted: true,
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
    return toListItem(updated);
  },

  /** 删除（owner/admin，软删） */
  async remove(id: string, userId: string, isAdmin: boolean) {
    const work = await prisma.work.findFirst({ where: { id, deletedAt: null } });
    if (!work) throw appError('NOT_FOUND', '作品不存在');
    if (!isAdmin && work.authorId !== userId) throw appError('FORBIDDEN', '无权删除');
    await prisma.work.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
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
    return related.map((w) => toListItem(w));
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

    // 上架：写 Dynamic(PUBLISH) + 通知粉丝
    if (action === 'APPROVE') {
      await notifyService.onWorkPublished(work.authorId, work.id, work.title);
    }

    return toListItem(
      await prisma.work.findUniqueOrThrow({
        where: { id: updated.id },
        include: WORK_LIST_INCLUDE,
      }),
    );
  },
};
