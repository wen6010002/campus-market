import { withErrorHandler, ok } from '@/server/lib/http';
import { requireUser } from '@/server/auth/session';
import { prisma } from '@/server/db';
import { achievementService } from '@/server/services/achievement.service';

/** 本人的完整荣誉墙：全字典解锁态 + 佩戴状态 + 数量轴当前值（灰格进度条） */
export const GET = withErrorHandler(async () => {
  const s = await requireUser();
  const { items, pinnedCount } = await achievementService.listHonor(s.userId);
  const where = { authorId: s.userId, deletedAt: null };
  const [helped, likes, favs, works] = await Promise.all([
    prisma.work.aggregate({ where, _sum: { downloads: true } }),
    prisma.work.aggregate({ where, _sum: { likes: true } }),
    prisma.work.aggregate({ where, _sum: { favs: true } }),
    prisma.work.count({ where: { ...where, status: 'PUBLISHED' } }),
  ]);
  return ok({
    items,
    pinnedCount,
    progresses: {
      helped: helped._sum.downloads ?? 0,
      likes: likes._sum.likes ?? 0,
      favs: favs._sum.favs ?? 0,
      works,
    },
  });
});
