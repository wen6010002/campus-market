import { prisma } from '../db';
import { cacheGet, cacheSet } from '../lib/cache';

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
          },
        },
        metric: w.favs,
      }));
    } else {
      const creators = await prisma.user.findMany({
        where: { role: { in: ['CREATOR', 'ADMIN'] } },
        include: CREATOR_INCLUDE,
      });

      const list = creators.map(toCreator);
      if (type === 'help') list.sort((a, b) => b.helped - a.helped);
      else if (type === 'creator') list.sort((a, b) => b.fans * b.works - a.fans * a.works);
      else list.sort((a, b) => Number(b.rate) * b.works - Number(a.rate) * a.works); // rate 加权

      result = list.slice(0, 6).map((c, i) => ({
        rank: i + 1,
        creator: c,
        metric: type === 'help' ? c.helped : type === 'creator' ? c.fans : Number(c.rate),
      }));
    }

    await cacheSet(cacheKey, result, 3600);
    return result;
  },
};
