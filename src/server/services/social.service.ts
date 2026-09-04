import { prisma } from '../db';
import { appError } from '../lib/errors';
import { redis } from '../lib/redis';
import { notifyService } from './notify.service';
import { achievementService } from './achievement.service';

const ratingStr = (d: { toFixed(n: number): string }): string => d.toFixed(1);

/** 赞/藏作者通知：每作品每日至多一条（SETNX 防轰炸），fire-and-forget */
async function notifyOwnerOnce(
  kind: 'like' | 'fav',
  authorId: string,
  workId: string,
  title: string,
) {
  const day = new Date().toISOString().slice(0, 10);
  const got = await redis.set(`nt:${kind}:${workId}:${day}`, '1', 'EX', 86400, 'NX');
  if (got !== 'OK') return;
  await notifyService.createNotification(
    authorId,
    'SYSTEM',
    kind === 'like'
      ? `👍 你的《${title}》今天收到了新的点赞`
      : `🔖 有同学把你的《${title}》收进了资料库`,
    `/work/${workId}`,
  );
}

/** 收藏（幂等 set：value=true 收藏 / false 取消） */
async function setFavorite(userId: string, workId: string, value: boolean) {
  return prisma.$transaction(async (tx) => {
    const work = await tx.work.findFirst({ where: { id: workId, deletedAt: null } });
    if (!work) throw appError('NOT_FOUND', '作品不存在');
    const existing = await tx.favorite.findUnique({ where: { userId_workId: { userId, workId } } });
    if (value && !existing) {
      await tx.favorite.create({ data: { userId, workId } });
      await tx.work.update({ where: { id: workId }, data: { favs: { increment: 1 } } });
      // V8：收藏轴成就 + 作者通知（不阻塞）
      achievementService.checkFavs(work.authorId).catch(() => {});
      notifyOwnerOnce('fav', work.authorId, workId, work.title).catch(() => {});
    } else if (!value && existing) {
      await tx.favorite.delete({ where: { userId_workId: { userId, workId } } });
      await tx.work.update({ where: { id: workId }, data: { favs: { decrement: 1 } } });
    }
    return {
      favorited: value,
      favs: (await tx.work.findUniqueOrThrow({ where: { id: workId } })).favs,
    };
  });
}

/** 点赞（幂等 set） */
async function setLike(userId: string, workId: string, value: boolean) {
  return prisma.$transaction(async (tx) => {
    const work = await tx.work.findFirst({ where: { id: workId, deletedAt: null } });
    if (!work) throw appError('NOT_FOUND', '作品不存在');
    const existing = await tx.like.findUnique({ where: { userId_workId: { userId, workId } } });
    if (value && !existing) {
      await tx.like.create({ data: { userId, workId } });
      await tx.work.update({ where: { id: workId }, data: { likes: { increment: 1 } } });
      // V8：点赞轴成就 + 作者通知（不阻塞）
      achievementService.checkLikes(work.authorId).catch(() => {});
      notifyOwnerOnce('like', work.authorId, workId, work.title).catch(() => {});
    } else if (!value && existing) {
      await tx.like.delete({ where: { userId_workId: { userId, workId } } });
      await tx.work.update({ where: { id: workId }, data: { likes: { decrement: 1 } } });
    }
    return {
      liked: value,
      likes: (await tx.work.findUniqueOrThrow({ where: { id: workId } })).likes,
    };
  });
}

/** 关注（幂等 set） */
async function setFollow(userId: string, creatorId: string, value: boolean) {
  return prisma.$transaction(async (tx) => {
    const creator = await tx.user.findUnique({ where: { id: creatorId } });
    if (!creator) throw appError('NOT_FOUND', '创作者不存在');
    if (creatorId === userId) throw appError('CONFLICT', '不能关注自己');
    const existing = await tx.follow.findUnique({
      where: { followerId_followingId: { followerId: userId, followingId: creatorId } },
    });
    const fans = () => tx.follow.count({ where: { followingId: creatorId } });
    if (value && !existing) {
      await tx.follow.create({ data: { followerId: userId, followingId: creatorId } });
    } else if (!value && existing) {
      await tx.follow.delete({
        where: { followerId_followingId: { followerId: userId, followingId: creatorId } },
      });
    }
    return { followed: value, fans: await fans() };
  });
}

const CREATOR_INCLUDE = { creator: true, student: true };

export const socialService = {
  /** 用户主页（V3-5）：任何用户都有主页（作品/评价/关注/粉丝），bio 优先 User 层 */
  async userDetail(userId: string, viewerId?: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null, status: { not: 'DELETED' } },
      include: { creator: true, student: true },
    });
    if (!user) throw appError('NOT_FOUND', '用户不存在');

    const [helped, fans, following, works, avgRating, myFollow, badges] = await Promise.all([
      prisma.work.aggregate({ where: { authorId: userId }, _sum: { downloads: true } }),
      prisma.follow.count({ where: { followingId: userId } }),
      prisma.follow.count({ where: { followerId: userId } }),
      prisma.work.count({ where: { authorId: userId, status: 'PUBLISHED', deletedAt: null } }),
      prisma.work.aggregate({
        where: { authorId: userId, ratingCount: { gt: 0 } },
        _avg: { rating: true },
      }),
      viewerId
        ? prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: viewerId, followingId: userId } },
          })
        : Promise.resolve(null),
      // V8：佩戴勋章栏（≤5，限时过期自动隐藏）
      achievementService.listPinned(userId),
    ]);

    return {
      id: user.id,
      username: user.username,
      avatarColor: user.avatarColor,
      hasAvatar: !!user.avatarKey,
      avatarVer: user.updatedAt.getTime(),
      bio: user.bio ?? user.creator?.bio ?? '',
      direction: user.creator?.direction ?? '',
      honor: user.creator?.honor ?? null,
      college: user.student?.college ?? '',
      major: user.student?.major ?? '',
      grade: user.student?.grade ?? '',
      verified: user.creator?.verified ?? false,
      isCreator: !!user.creator,
      helped: helped._sum.downloads ?? 0,
      fans,
      following,
      works,
      rate: ratingStr(avgRating._avg.rating ?? 0),
      myFollow: !!myFollow,
      isSelf: viewerId === userId,
      badges, // V8 佩戴勋章栏（≤5，公开）
    };
  },

  /** 用户公开评价历史（V3-5） */
  async userRatings(userId: string) {
    const ratings = await prisma.workRating.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { work: { select: { id: true, title: true, course: true } } },
    });
    return ratings.map((r) => ({
      id: r.id,
      stars: r.stars,
      text: r.text,
      createdAt: r.createdAt.toISOString(),
      work: r.work,
    }));
  },

  /** 关注/粉丝列表（V3-5，分页 20） */
  async userFollows(
    userId: string,
    type: 'following' | 'followers',
    page: number,
    viewerId?: string,
  ) {
    const take = 20;
    const skip = (page - 1) * take;
    const rows = await (type === 'following'
      ? prisma.follow.findMany({
          where: { followerId: userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
          include: { following: { include: { creator: true, student: true } } },
        })
      : prisma.follow.findMany({
          where: { followingId: userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
          include: { follower: { include: { creator: true, student: true } } },
        }));
    const ids = rows.map((r: any) => (type === 'following' ? r.followingId : r.followerId));
    const myFollows = viewerId
      ? await prisma.follow.findMany({
          where: { followerId: viewerId, followingId: { in: ids } },
          select: { followingId: true },
        })
      : [];
    const mine = new Set(myFollows.map((f: any) => f.followingId));
    const fansCounts = await Promise.all(
      ids.map((id: string) => prisma.follow.count({ where: { followingId: id } })),
    );
    return rows.map((r: any, i: number) => {
      const u = type === 'following' ? r.following : r.follower;
      return {
        id: u.id,
        username: u.username,
        avatarColor: u.avatarColor,
        hasAvatar: !!u.avatarKey,
        avatarVer: u.updatedAt.getTime(),
        bio: u.bio ?? u.creator?.bio ?? '',
        college: u.student?.college ?? '',
        verified: u.creator?.verified ?? false,
        fans: fansCounts[i],
        myFollow: mine.has(u.id),
        isSelf: viewerId === u.id,
      };
    });
  },

  favorite: (userId: string, workId: string) => setFavorite(userId, workId, true),
  unfavorite: (userId: string, workId: string) => setFavorite(userId, workId, false),

  /** V8 收藏置顶（收藏栏「以后再看」） */
  async favoritePin(userId: string, workId: string, on: boolean) {
    const f = await prisma.favorite.findUnique({
      where: { userId_workId: { userId, workId } },
    });
    if (!f) throw appError('NOT_FOUND', '未收藏该作品');
    await prisma.favorite.update({
      where: { id: f.id },
      data: { pinned: on, ...(on ? { pinnedAt: new Date() } : {}) },
    });
    return { pinned: on };
  },
  like: (userId: string, workId: string) => setLike(userId, workId, true),
  unlike: (userId: string, workId: string) => setLike(userId, workId, false),
  follow: (userId: string, creatorId: string) => setFollow(userId, creatorId, true),
  unfollow: (userId: string, creatorId: string) => setFollow(userId, creatorId, false),

  /** 关注动态 feed（聚合关注创作者的最新动态） */
  async followingFeed(userId: string) {
    const follows = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const ids = follows.map((f) => f.followingId);
    if (!ids.length) return [];
    const dynamics = await prisma.dynamic.findMany({
      where: { creatorId: { in: ids } },
      include: {
        creator: { include: { creator: true, student: true } },
        work: {
          include: { author: { include: { creator: true } }, tags: { include: { tag: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    // V8：动态流作者挂展示成就勋章
    const dynBadges = await achievementService.inlineBadges(dynamics.map((d) => d.creatorId));
    return dynamics.map((d) => ({
      id: d.id,
      type: d.type,
      createdAt: d.createdAt.toISOString(),
      creator: {
        badge: dynBadges[d.creatorId] ?? null,
        id: d.creator.id,
        username: d.creator.username,
        avatarColor: d.creator.avatarColor,
        hasAvatar: !!d.creator.avatarKey,
        avatarVer: d.creator.updatedAt.getTime(),
        bio: d.creator.creator?.bio ?? '',
        direction: d.creator.creator?.direction ?? '',
        honor: d.creator.creator?.honor ?? null,
        college: d.creator.student?.college ?? '',
        major: d.creator.student?.major ?? '',
        verified: d.creator.creator?.verified ?? false,
        helped: 0,
        fans: 0,
        works: 0,
        rate: '0.0',
      },
      work: d.work
        ? {
            id: d.work.id,
            title: d.work.title,
            description: d.work.description,
            course: d.work.course,
            fileType: d.work.fileType,
            fileSize: d.work.fileSize,
            pages: d.work.pages,
            coverIcon: d.work.coverIcon,
            coverTheme: d.work.coverTheme,
            isFree: d.work.isFree,
            price: d.work.price.toFixed(2),
            oldPrice: d.work.oldPrice?.toFixed(2) ?? null,
            quality: d.work.quality,
            status: d.work.status,
            rating: ratingStr(d.work.rating),
            ratingCount: d.work.ratingCount,
            downloads: d.work.downloads,
            favs: d.work.favs,
            likes: d.work.likes,
            views: d.work.views,
            tags: d.work.tags.map((t) => t.tag.name),
            author: {
              id: d.work.author.id,
              username: d.work.author.username,
              avatarColor: d.work.author.avatarColor,
              hasAvatar: !!d.work.author.avatarKey,
              avatarVer: d.work.author.updatedAt.getTime(),
              verified: d.work.author.creator?.verified ?? false,
            },
            publishedAt: d.work.publishedAt?.toISOString() ?? null,
            updatedAt: d.work.updatedAt.toISOString(),
          }
        : undefined,
    }));
  },

  /** 我的收藏（分页） */
  async myFavorites(userId: string, page: number, pageSize: number) {
    const where = { userId };
    const [total, favorites] = await Promise.all([
      prisma.favorite.count({ where }),
      prisma.favorite.findMany({
        where,
        include: {
          work: {
            include: { author: { include: { creator: true } }, tags: { include: { tag: true } } },
          },
        },
        // V8：置顶优先，其余按收藏时间倒序
        orderBy: [{ pinned: 'desc' }, { pinnedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    // V8：已下载标记（收藏≠已存本地）批量判定
    const [dlRows, favBadges] = await Promise.all([
      prisma.download.findMany({
        where: { userId, workId: { in: favorites.map((f) => f.workId) } },
        select: { workId: true },
      }),
      // V8：收藏列表作者挂佩戴勋章
      achievementService.inlineBadges(favorites.map((f) => f.work.authorId)),
    ]);
    const dlSet = new Set(dlRows.map((d) => d.workId));
    return {
      data: favorites.map((f) => {
        const w = f.work;
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
          category: w.category,
          isFree: w.isFree,
          price: w.price.toFixed(2),
          // V8：置顶 / 已下载 / 下架感知（下架灰显而非消失）
          pinned: f.pinned,
          downloaded: dlSet.has(w.id),
          workStatus: w.status,
          deletedAt: w.deletedAt?.toISOString() ?? null,
          oldPrice: w.oldPrice?.toFixed(2) ?? null,
          quality: w.quality,
          status: w.status,
          rating: ratingStr(w.rating),
          ratingCount: w.ratingCount,
          downloads: w.downloads,
          favs: w.favs,
          likes: w.likes,
          views: w.views,
          tags: w.tags.map((t) => t.tag.name),
          author: {
            id: w.author.id,
            username: w.author.username,
            avatarColor: w.author.avatarColor,
            verified: w.author.creator?.verified ?? false,
            badge: favBadges[w.authorId] ?? null,
          },
          publishedAt: w.publishedAt?.toISOString() ?? null,
          updatedAt: w.updatedAt.toISOString(),
        };
      }),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  /** 创作者详情 */
  async creatorDetail(creatorId: string, viewerId?: string) {
    const user = await prisma.user.findUnique({
      where: { id: creatorId },
      include: CREATOR_INCLUDE,
    });
    if (!user) throw appError('NOT_FOUND', '创作者不存在');

    const [helped, fans, works, avgRating, myFollow] = await Promise.all([
      prisma.work.aggregate({ where: { authorId: creatorId }, _sum: { downloads: true } }),
      prisma.follow.count({ where: { followingId: creatorId } }),
      prisma.work.count({ where: { authorId: creatorId, status: 'PUBLISHED', deletedAt: null } }),
      prisma.work.aggregate({
        where: { authorId: creatorId, ratingCount: { gt: 0 } },
        _avg: { rating: true },
      }),
      viewerId
        ? prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: viewerId, followingId: creatorId } },
          })
        : Promise.resolve(null),
    ]);

    return {
      id: user.id,
      username: user.username,
      avatarColor: user.avatarColor,
      bio: user.creator?.bio ?? '',
      direction: user.creator?.direction ?? '',
      honor: user.creator?.honor ?? null,
      college: user.student?.college ?? '',
      major: user.student?.major ?? '',
      verified: user.creator?.verified ?? false,
      helped: helped._sum.downloads ?? 0,
      fans,
      works,
      rate: ratingStr(avgRating._avg.rating ?? 0),
      myFollow: !!myFollow,
    };
  },

  /** 创作者作品（filter=free|fine|hot） */
  async creatorWorks(creatorId: string, filter?: string) {
    const where: any = { authorId: creatorId, status: 'PUBLISHED', deletedAt: null };
    if (filter === 'free') where.isFree = true;
    if (filter === 'fine') where.isFree = false;
    const orderBy =
      filter === 'hot' ? [{ downloads: 'desc' as const }] : [{ publishedAt: 'desc' as const }];
    const works = await prisma.work.findMany({
      where,
      include: { author: { include: { creator: true } }, tags: { include: { tag: true } } },
      orderBy,
      take: 50,
    });
    return works.map((w) => ({
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
      tags: w.tags.map((t) => t.tag.name),
      author: {
        id: w.author.id,
        username: w.author.username,
        avatarColor: w.author.avatarColor,
        hasAvatar: !!w.author.avatarKey,
        avatarVer: w.author.updatedAt.getTime(),
        verified: w.author.creator?.verified ?? false,
      },
      publishedAt: w.publishedAt?.toISOString() ?? null,
      updatedAt: w.updatedAt.toISOString(),
    }));
  },

  /** 创作者统计 */
  async creatorStats(creatorId: string) {
    const [helped, fans, works, avgRating] = await Promise.all([
      prisma.work.aggregate({ where: { authorId: creatorId }, _sum: { downloads: true } }),
      prisma.follow.count({ where: { followingId: creatorId } }),
      prisma.work.count({ where: { authorId: creatorId, status: 'PUBLISHED', deletedAt: null } }),
      prisma.work.aggregate({
        where: { authorId: creatorId, ratingCount: { gt: 0 } },
        _avg: { rating: true },
      }),
    ]);
    return {
      helped: helped._sum.downloads ?? 0,
      fans,
      works,
      avgRating: ratingStr(avgRating._avg.rating ?? 0),
    };
  },
};
