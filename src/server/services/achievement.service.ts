import { prisma } from '../db';
import { appError } from '../lib/errors';
import { notifyService } from './notify.service';
import { logger } from '../lib/logger';
import type { AchievementKey } from '@/lib/constants';
import { THRESHOLD_LADDER, ACHIEVEMENT_DICT } from '@/lib/achievements';

/** 佩戴上限：少才值钱（展示栏+名字徽章数据源） */
export const PIN_LIMIT = 5;

const ACTIVE = (now = new Date()) =>
  ({ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }) as {
    OR: Array<{ expiresAt: null } | { expiresAt: { gt: Date } }>;
  };

// V8 荣耀引擎：授予（幂等+通知+弹层）、事件判定（下载/赞/藏/作品）、限时榜单授予、
// 荣誉墙（公开）、佩戴管理（≤5）、解锁弹层（pop）、名字徽章批量查询。
export const achievementService = {
  /**
   * 授予成就（幂等）。限时成就允许卫冕：已存在且上次已过期 → 刷新 expiresAt 重新点亮。
   * 成功授予后：ACHIEVEMENT 通知 + popped=false（下次打开页面弹礼花）。
   */
  async grant(userId: string, key: AchievementKey, opts?: { expiresAt?: Date }): Promise<boolean> {
    const achievement = await prisma.achievement.findUnique({ where: { key } });
    if (!achievement) return false;
    const existing = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId, achievementId: achievement.id } },
    });
    if (existing) {
      // 卫冕：限时成就过期后重新上榜 → 续期点亮（pinned 保留原状态）
      if (opts?.expiresAt && existing.expiresAt && existing.expiresAt <= new Date()) {
        await prisma.userAchievement.update({
          where: { id: existing.id },
          data: { expiresAt: opts.expiresAt, popped: false },
        });
        await this.notifyGrant(userId, achievement.title, achievement.description);
        return true;
      }
      return false;
    }
    try {
      await prisma.userAchievement.create({
        data: { userId, achievementId: achievement.id, expiresAt: opts?.expiresAt ?? null },
      });
      await this.notifyGrant(userId, achievement.title, achievement.description);
      return true;
    } catch {
      return false; // 并发下唯一约束兜底
    }
  },

  async notifyGrant(userId: string, title: string, desc: string | null) {
    try {
      await notifyService.createNotification(
        userId,
        'ACHIEVEMENT',
        `🏆 解锁成就「${title}」——${desc ?? ''}`,
        `/user/${userId}?tab=honor`,
      );
    } catch (e) {
      logger.error({ e, userId }, 'achievement notify failed'); // 通知失败不阻塞授予
    }
  },

  /** 事件判定：数量阶梯（阈值内全部尝试授予，幂等保证只发新解锁的） */
  async checkCount(
    userId: string,
    metric: keyof typeof THRESHOLD_LADDER,
    value: number,
  ): Promise<void> {
    const ladder = THRESHOLD_LADDER[metric];
    for (const step of ladder) {
      if (value >= step.n) await this.grant(userId, step.key as AchievementKey);
    }
  },

  /** 帮助轴：作品下载总和（=帮助了多少人） */
  async checkHelp(userId: string) {
    const r = await prisma.work.aggregate({
      where: { authorId: userId, deletedAt: null },
      _sum: { downloads: true },
    });
    await this.checkCount(userId, 'helped', r._sum.downloads ?? 0);
  },

  /** 点赞轴 / 收藏轴 */
  async checkLikes(userId: string) {
    const r = await prisma.work.aggregate({
      where: { authorId: userId, deletedAt: null },
      _sum: { likes: true },
    });
    await this.checkCount(userId, 'likes', r._sum.likes ?? 0);
  },

  async checkFavs(userId: string) {
    const r = await prisma.work.aggregate({
      where: { authorId: userId, deletedAt: null },
      _sum: { favs: true },
    });
    await this.checkCount(userId, 'favs', r._sum.favs ?? 0);
  },

  /** 作品轴：过审数（审核通过时触发） */
  async checkWorks(userId: string) {
    const n = await prisma.work.count({
      where: { authorId: userId, status: 'PUBLISHED', deletedAt: null },
    });
    await this.checkCount(userId, 'works', n);
  },

  /**
   * 周榜/月榜授予（worker 调用）：按上一周期作品新增下载数取作者 TopN。
   * 限时成就：expiresAt = 授予时刻 + days 天（到期从佩戴栏/名字徽章/荣誉墙隐藏，数据保留）。
   */
  async grantLeaderboard(key: 'WEEKLY_HOT' | 'MONTHLY_STAR', top: number, days: number) {
    const dict = ACHIEVEMENT_DICT.find((a) => a.key === key)!;
    const since = new Date(Date.now() - days * 24 * 3600_000);
    const rows = await prisma.work.groupBy({
      by: ['authorId'],
      where: { status: 'PUBLISHED', deletedAt: null, updatedAt: { gte: since } },
      _sum: { downloads: true },
      orderBy: { _sum: { downloads: 'desc' } },
      take: top,
    });
    const expiresAt = new Date(Date.now() + days * 24 * 3600_000);
    let granted = 0;
    for (const row of rows) {
      if ((row._sum.downloads ?? 0) <= 0) continue;
      const ok = await this.grant(row.authorId, key, { expiresAt });
      if (ok) granted++;
    }
    logger.info({ key, granted, dict: dict.title }, 'leaderboard achievements granted');
    return granted;
  },

  /** 荣誉墙（公开）：全字典 + 我的解锁态（过期归入 expired，不算已佩戴/徽章） */
  async listHonor(userId: string) {
    const [dict, mine] = await Promise.all([
      prisma.achievement.findMany(),
      prisma.userAchievement.findMany({
        where: { userId },
        include: { achievement: true },
        orderBy: { earnedAt: 'desc' },
      }),
    ]);
    const mineMap = new Map(mine.map((m) => [m.achievementId, m]));
    const now = Date.now();
    const items = dict
      .map((a) => {
        const m = mineMap.get(a.id);
        const active = !!(m && (!m.expiresAt || m.expiresAt.getTime() > now));
        return {
          key: a.key,
          emoji: a.emoji,
          title: a.title,
          rarity: a.rarity,
          symbol: a.symbol,
          description: a.description,
          got: !!m,
          active,
          pinned: !!(m?.pinned && active),
          earnedAt: m?.earnedAt.toISOString() ?? null,
          expiresAt: m?.expiresAt?.toISOString() ?? null,
          popped: m?.popped ?? false,
        };
      })
      .sort((a, b) => {
        // 已解锁在前（active > 过期 > 未解锁），同组按稀有度降序
        const rank = (x: typeof a) => (x.active ? 0 : x.got ? 1 : 2);
        const order = ['bronze', 'silver', 'gold', 'plat', 'diamond', 'lgd'];
        return rank(a) - rank(b) || order.indexOf(b.rarity) - order.indexOf(a.rarity);
      });
    return { items, pinnedCount: items.filter((i) => i.pinned).length };
  },

  /** 佩戴/卸下（≤5，过期不可佩戴；限时到期自动失效不用手动卸） */
  async pin(userId: string, key: AchievementKey, on: boolean) {
    const achievement = await prisma.achievement.findUnique({ where: { key } });
    if (!achievement) return { pinned: false };
    const mine = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId, achievementId: achievement.id } },
    });
    if (!mine) return { pinned: false };
    if (mine.expiresAt && mine.expiresAt <= new Date()) return { pinned: false };
    if (on) {
      const count = await prisma.userAchievement.count({
        where: { userId, pinned: true, ...ACTIVE() },
      });
      if (count >= PIN_LIMIT) {
        throw appError('VALIDATION', `最多佩戴 ${PIN_LIMIT} 枚勋章，先卸下一枚吧`);
      }
    }
    await prisma.userAchievement.update({
      where: { id: mine.id },
      data: { pinned: on, ...(on ? { pinnedAt: new Date() } : {}) },
    });
    return { pinned: on };
  },

  /** 佩戴栏（主页 hero 区，公开） */
  async listPinned(userId: string) {
    const rows = await prisma.userAchievement.findMany({
      where: { userId, pinned: true, ...ACTIVE() },
      include: { achievement: true },
      orderBy: { pinnedAt: 'asc' },
      take: PIN_LIMIT,
    });
    return rows.map((r) => ({
      key: r.achievement.key,
      title: r.achievement.title,
      rarity: r.achievement.rarity,
      symbol: r.achievement.symbol,
      expiresAt: r.expiresAt?.toISOString() ?? null,
    }));
  },

  /** 名字旁小徽章（评论区等）：批量取每用户佩戴的第一枚（未过期） */
  async inlineBadges(userIds: string[]) {
    if (!userIds.length)
      return {} as Record<string, { key: string; title: string; rarity: string; symbol: string }>;
    const rows = await prisma.userAchievement.findMany({
      where: { userId: { in: userIds }, pinned: true, ...ACTIVE() },
      include: { achievement: true },
      orderBy: { pinnedAt: 'asc' },
    });
    const map: Record<string, { key: string; title: string; rarity: string; symbol: string }> = {};
    for (const r of rows) {
      if (!map[r.userId]) {
        map[r.userId] = {
          key: r.achievement.key,
          title: r.achievement.title,
          rarity: r.achievement.rarity,
          symbol: r.achievement.symbol,
        };
      }
    }
    return map;
  },

  /** 解锁弹层：取一条未展示的（展示后 confirmPop） */
  async popNext(userId: string) {
    const now = new Date();
    const row = await prisma.userAchievement.findFirst({
      where: { userId, popped: false, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      include: { achievement: true },
      orderBy: { earnedAt: 'asc' },
    });
    if (!row) return null;
    return {
      id: row.id,
      key: row.achievement.key,
      title: row.achievement.title,
      rarity: row.achievement.rarity,
      symbol: row.achievement.symbol,
      description: row.achievement.description,
    };
  },

  async confirmPop(id: string, userId: string) {
    await prisma.userAchievement.updateMany({
      where: { id, userId },
      data: { popped: true },
    });
  },

  /** 兼容旧调用（order/rating service）：字典+got */
  async listForUser(userId: string) {
    const { items } = await this.listHonor(userId);
    return items.map((i) => ({ key: i.key, emoji: i.emoji, title: i.title, got: i.got }));
  },
};
