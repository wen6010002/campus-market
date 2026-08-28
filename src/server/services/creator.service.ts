import { prisma } from '../db';
import { appError } from '../lib/errors';
import { incomeService } from './income.service';

const ratingStr = (d: { toFixed(n: number): string } | null | undefined): string =>
  d === null || d === undefined ? '0.0' : d.toFixed(1);

export const creatorService = {
  /** 创作者中心概览 */
  async overview(userId: string) {
    const cp = await prisma.creatorProfile.findUnique({ where: { userId } });
    if (!cp) throw appError('FORBIDDEN', '需要创作者权限');

    const [helped, fans, works, freeWorks, fineWorks, avgRating, income] = await Promise.all([
      prisma.work.aggregate({ where: { authorId: userId }, _sum: { downloads: true } }),
      prisma.follow.count({ where: { followingId: userId } }),
      prisma.work.count({ where: { authorId: userId, status: 'PUBLISHED', deletedAt: null } }),
      prisma.work.count({
        where: { authorId: userId, status: 'PUBLISHED', deletedAt: null, isFree: true },
      }),
      prisma.work.count({
        where: { authorId: userId, status: 'PUBLISHED', deletedAt: null, isFree: false },
      }),
      prisma.work.aggregate({
        where: { authorId: userId, ratingCount: { gt: 0 } },
        _avg: { rating: true },
      }),
      incomeService.summary(userId),
    ]);

    return {
      helped: helped._sum.downloads ?? 0,
      income,
      fans,
      avgRating: ratingStr(avgRating._avg.rating),
      works,
      freeWorks,
      fineWorks,
    };
  },

  /** 我的作品（含审核状态 + 收益） */
  async works(userId: string) {
    const works = await prisma.work.findMany({
      where: { authorId: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const result = [];
    for (const w of works) {
      const earnings = await prisma.creatorIncome.aggregate({
        where: { creator: { userId }, order: { workId: w.id } },
        _sum: { amount: true },
      });
      result.push({
        id: w.id,
        title: w.title,
        course: w.course,
        coverIcon: w.coverIcon,
        coverTheme: w.coverTheme,
        isFree: w.isFree,
        price: w.price.toFixed(2),
        status: w.status,
        quality: w.quality,
        rating: ratingStr(w.rating),
        ratingCount: w.ratingCount,
        downloads: w.downloads,
        favs: w.favs,
        views: w.views,
        earnings: (earnings._sum.amount ?? 0).toFixed(2),
        rejectedReason: w.rejectedReason,
        publishedAt: w.publishedAt?.toISOString() ?? null,
        createdAt: w.createdAt.toISOString(),
      });
    }
    return result;
  },

  /** 数据中心（作品表现） */
  async data(userId: string) {
    const works = await prisma.work.findMany({
      where: { authorId: userId, deletedAt: null },
      select: {
        id: true,
        title: true,
        views: true,
        downloads: true,
        favs: true,
        rating: true,
        price: true,
        isFree: true,
      },
      orderBy: { downloads: 'desc' },
    });
    const data = [];
    for (const w of works) {
      const earnings = await prisma.creatorIncome.aggregate({
        where: { creator: { userId }, order: { workId: w.id } },
        _sum: { amount: true },
      });
      data.push({
        id: w.id,
        title: w.title,
        views: w.views,
        downloads: w.downloads,
        favs: w.favs,
        rating: ratingStr(w.rating),
        price: w.price.toFixed(2),
        isFree: w.isFree,
        earnings: (earnings._sum.amount ?? 0).toFixed(2),
      });
    }
    return data;
  },
};
