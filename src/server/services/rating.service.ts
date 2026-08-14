import { prisma } from '../db';
import { redis } from '../lib/redis';
import { appError } from '../lib/errors';
import { sanitize } from '../lib/sanitize';
import { achievementService } from './achievement.service';
import type { CreateRatingInput } from '@/lib/zod/rating';
import type { RatingDist } from '../algos/rating';

const ratingStr = (d: { toFixed(n: number): string }): string => d.toFixed(1);

const RATING_INCLUDE = {
  user: { select: { username: true, avatarColor: true } },
  tags: { include: { tag: true } },
} as const;

function toRating(r: any, viewerId?: string) {
  return {
    id: r.id,
    stars: r.stars,
    text: r.text,
    helpfulCount: r.helpfulCount,
    creatorReply: r.creatorReply,
    repliedAt: r.repliedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    user: { username: r.user.username, avatarColor: r.user.avatarColor },
    tags: r.tags.map((t: any) => t.tag.name),
    _mine: r.userId === viewerId,
  };
}

const SORT_SQL: Record<string, { column: string; dir: 'asc' | 'desc' }> = {
  new: { column: 'createdAt', dir: 'desc' },
  helpful: { column: 'helpfulCount', dir: 'desc' },
  high: { column: 'stars', dir: 'desc' },
  low: { column: 'stars', dir: 'asc' },
};

export const ratingService = {
  /** 提交评分（资格 + 唯一约束 + FOR UPDATE 锁 Work 行事务重算） */
  async create(userId: string, workId: string, input: CreateRatingInput) {
    const result = await prisma.$transaction(async (tx) => {
      const work = await tx.work.findFirst({
        where: { id: workId, deletedAt: null, status: 'PUBLISHED' },
      });
      if (!work) throw appError('NOT_FOUND', '作品不存在');

      // 资格：Download 或 Order(PAID)
      const [dl, order] = await Promise.all([
        tx.download.findUnique({ where: { workId_userId: { workId, userId } } }),
        tx.order.findFirst({ where: { workId, buyerId: userId, payStatus: 'PAID' } }),
      ]);
      if (!dl && !order) throw appError('NO_RATING_ACCESS', '只有下载或购买过的同学才能评价');

      const existing = await tx.workRating.findUnique({
        where: { workId_userId: { workId, userId } },
      });
      if (existing) throw appError('ALREADY_RATED', '你已经评价过这个作品了');

      // 先锁 Work 行（避免 INSERT FK 的 FOR KEY SHARE 与 FOR UPDATE 升级死锁）
      await tx.$queryRaw`SELECT id FROM works WHERE id = ${workId} FOR UPDATE`;
      const w = await tx.work.findUniqueOrThrow({ where: { id: workId } });
      const dist = w.ratingDist as unknown as RatingDist;
      const newCount = w.ratingCount + 1;
      const newRating =
        Math.round(((Number(w.rating) * w.ratingCount + input.stars) / newCount) * 10) / 10;

      const rating = await tx.workRating.create({
        data: { workId, userId, stars: input.stars, text: sanitize(input.text) },
      });

      // 标签
      for (const name of input.tags) {
        const tag = await tx.ratingTag.upsert({
          where: { name },
          update: {},
          create: {
            name,
            isPositive: !['内容过时', '与描述不符', '内容质量一般', '排版混乱'].includes(name),
          },
        });
        await tx.workRatingTag.create({ data: { ratingId: rating.id, tagId: tag.id } });
      }

      await tx.work.update({
        where: { id: workId },
        data: {
          rating: newRating,
          ratingCount: newCount,
          ratingDist: {
            ...dist,
            [String(input.stars)]: (dist[String(input.stars) as keyof RatingDist] ?? 0) + 1,
          },
        },
      });

      const full = await tx.workRating.findUniqueOrThrow({
        where: { id: rating.id },
        include: RATING_INCLUDE,
      });
      return toRating(full, userId);
    });
    // 成就：首个五星（事务后触发，不拉长事务）
    if (input.stars === 5) {
      const w = await prisma.work.findUnique({ where: { id: workId }, select: { authorId: true } });
      if (w) await achievementService.grant(w.authorId, 'FIRST_FIVE_STAR');
    }
    return result;
  },

  /** 评价列表 + 汇总（公开） */
  async list(workId: string, sort: string, page: number, pageSize: number) {
    const work = await prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw appError('NOT_FOUND', '作品不存在');

    const orderBy = SORT_SQL[sort] ?? SORT_SQL.new;
    const where = { workId };
    const [total, ratings] = await Promise.all([
      prisma.workRating.count({ where }),
      prisma.workRating.findMany({
        where,
        include: RATING_INCLUDE,
        orderBy: { [orderBy.column]: orderBy.dir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);
    return {
      data: ratings.map((r) => toRating(r)),
      pagination: { page, pageSize, total, totalPages },
      summary: {
        rating: ratingStr(work.rating),
        ratingCount: work.ratingCount,
        dist: work.ratingDist as unknown as RatingDist,
      },
    };
  },

  /** 可选评价标签（正/负） */
  async tags() {
    const tags = await prisma.ratingTag.findMany();
    return {
      pos: tags.filter((t) => t.isPositive).map((t) => t.name),
      neg: tags.filter((t) => !t.isPositive).map((t) => t.name),
    };
  },

  /** 有用（去重用 Redis set，每人每评一次） */
  async helpful(ratingId: string, userId: string) {
    const rating = await prisma.workRating.findUnique({ where: { id: ratingId } });
    if (!rating) throw appError('NOT_FOUND', '评价不存在');
    const key = `helpful:${ratingId}:${userId}`;
    const added = await redis.sadd(key, '1');
    if (added === 1) {
      await prisma.workRating.update({
        where: { id: ratingId },
        data: { helpfulCount: { increment: 1 } },
      });
    }
    const updated = await prisma.workRating.findUniqueOrThrow({ where: { id: ratingId } });
    return { helpfulCount: updated.helpfulCount };
  },

  /** 作者回复（该作品作者） */
  async reply(ratingId: string, authorUserId: string, text: string) {
    const rating = await prisma.workRating.findUnique({
      where: { id: ratingId },
      include: { work: true },
    });
    if (!rating) throw appError('NOT_FOUND', '评价不存在');
    if (rating.work.authorId !== authorUserId) throw appError('FORBIDDEN', '只有该作品作者可回复');

    const updated = await prisma.workRating.update({
      where: { id: ratingId },
      data: { creatorReply: sanitize(text), repliedAt: new Date() },
      include: RATING_INCLUDE,
    });
    return toRating(updated);
  },

  /** 我的评价 */
  async meRatings(userId: string) {
    const ratings = await prisma.workRating.findMany({
      where: { userId },
      include: { ...RATING_INCLUDE, work: { select: { id: true, title: true, course: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ratings.map((r) => ({
      ...toRating(r, userId),
      work: { id: r.work.id, title: r.work.title, course: r.work.course },
    }));
  },
};
