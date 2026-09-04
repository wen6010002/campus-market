import { prisma } from '../db';
import { cacheGet, cacheSet } from '../lib/cache';
import { achievementService } from './achievement.service';

const ratingStr = (d: { toFixed(n: number): string }): string => d.toFixed(1);

const CREATOR_INCLUDE = {
  creator: true,
  student: true,
  works: {
    where: { status: 'PUBLISHED' as const, deletedAt: null },
    select: { downloads: true, rating: true, ratingCount: true, favs: true },
  },
  _count: { select: { followings: true } },
} as const;

function toCreator(c: any) {
  const helped = c.works.reduce((s: number, w: any) => s + w.downloads, 0);
  const rated = c.works.filter((w: any) => w.ratingCount > 0);
  const rate = rated.length
    ? rated.reduce((s: number, w: any) => s + Number(w.rating), 0) / rated.length
    : 0;
  return {
    id: c.id,
    username: c.username,
    avatarColor: c.avatarColor,
    hasAvatar: !!c.avatarKey,
    avatarVer: c.updatedAt.getTime(),
    bio: c.creator?.bio ?? '',
    direction: c.creator?.direction ?? '',
    honor: c.creator?.honor ?? null,
    college: c.student?.college ?? '',
    major: c.student?.major ?? '',
    verified: c.creator?.verified ?? false,
    helped,
    fans: c._count.followings,
    works: c.works.length,
    rate: ratingStr({ toFixed: () => rate.toFixed(1) }),
  };
}

export const rankService = {
  /** 排行榜（type=help|rate|fav|creator），返回 top6 */
  async ranks(type: string) {
    const cacheKey = `rank:${type}`;
    const cached = await cacheGet<any>(cacheKey);
    if (cached) return cached;

    let result;
    if (type === 'fav') {
      const works = await prisma.work.findMany({
        where: { status: 'PUBLISHED', deletedAt: null },
        include: { author: { include: { creator: true } }, tags: { include: { tag: true } } },
        orderBy: { favs: 'desc' },
        take: 6,
      });
      // V8：作品榜作者挂佩戴勋章
      const workBadges = await achievementService.inlineBadges(works.map((w) => w.authorId));
      result = works.map((w, i) => ({
        rank: i + 1,
        work: {
          id: w.id,
          title: w.title,
          course: w.course,
          coverIcon: w.coverIcon,
          coverTheme: w.coverTheme,
          favs: w.favs,
          downloads: w.downloads,
          rating: ratingStr(w.rating),
          author: {
            id: w.author.id,
            username: w.author.username,
            avatarColor: w.author.avatarColor,
            hasAvatar: !!w.author.avatarKey,
            avatarVer: w.author.updatedAt.getTime(),
            badge: workBadges[w.authorId] ?? null,
          },
        },
        metric: w.favs,
      }));
    } else {
      const creators = await prisma.user.findMany({
        where: { role: { in: ['CREATOR', 'ADMIN'] } },
        include: CREATOR_INCLUDE,
      });

      // V8：创作者榜挂佩戴勋章（佩戴第一枚）
      const creatorBadges = await achievementService.inlineBadges(creators.map((c) => c.id));
      const list = creators.map((c) => ({ ...toCreator(c), badge: creatorBadges[c.id] ?? null }));
      if (type === 'help') list.sort((a, b) => b.helped - a.helped);
      else if (type === 'creator') list.sort((a, b) => b.fans * b.works - a.fans * a.works);
      else list.sort((a, b) => Number(b.rate) * b.works - Number(a.rate) * a.works); // rate 加权

      result = list.slice(0, 6).map((c, i) => ({
        rank: i + 1,
        creator: c,
        metric: type === 'help' ? c.helped : type === 'creator' ? c.fans : Number(c.rate),
      }));
    }

    // 榜单缓存 5 分钟（原 1h 会把头像/用户名变更冻住太久；头像/资料更新时另会主动清除）
    await cacheSet(cacheKey, result, 300);
    return result;
  },
};
