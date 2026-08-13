import { prisma } from '../db';
import { appError } from '../lib/errors';

const ratingStr = (d: { toFixed(n: number): string }): string => d.toFixed(1);

const WORK_INCLUDE = {
  author: { include: { creator: true } },
  tags: { include: { tag: true } },
} as const;

function toWork(w: any) {
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
    price: w.price.toFixed(2),
    oldPrice: w.oldPrice?.toFixed(2) ?? null,
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

function toCreator(c: any) {
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
    helped: 0,
    fans: 0,
    works: 0,
    rate: '0.0',
  };
}

export const searchService = {
  /** 搜索（作品 title/desc/course/tags + 创作者 username/direction） */
  async search(q: string) {
    if (!q || !q.trim()) return { works: [], creators: [], total: 0 };
    const kw = q.trim();

    const [works, creators] = await Promise.all([
      prisma.work.findMany({
        where: {
          status: 'PUBLISHED',
          deletedAt: null,
          OR: [
            { title: { contains: kw, mode: 'insensitive' } },
            { description: { contains: kw, mode: 'insensitive' } },
            { course: { contains: kw, mode: 'insensitive' } },
            { tags: { some: { tag: { name: { contains: kw, mode: 'insensitive' } } } } },
          ],
        },
        include: WORK_INCLUDE,
        orderBy: { downloads: 'desc' },
        take: 50,
      }),
      prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: kw, mode: 'insensitive' } },
            { creator: { is: { direction: { contains: kw, mode: 'insensitive' } } } },
          ],
        },
        include: { creator: true, student: true },
        take: 20,
      }),
    ]);

    const workItems = works.map(toWork);
    const creatorItems = creators.map(toCreator);
    return {
      works: workItems,
      creators: creatorItems,
      total: workItems.length + creatorItems.length,
    };
  },
};
