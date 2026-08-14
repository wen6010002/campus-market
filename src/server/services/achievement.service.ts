import { prisma } from '../db';
import type { AchievementKey } from '@/lib/constants';

// 成就服务：幂等授予 + 用户成就墙。
export const achievementService = {
  /** 授予成就（幂等：查重 + 唯一约束兜底） */
  async grant(userId: string, key: AchievementKey): Promise<boolean> {
    const achievement = await prisma.achievement.findUnique({ where: { key } });
    if (!achievement) return false;
    const existing = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId, achievementId: achievement.id } },
    });
    if (existing) return false;
    try {
      await prisma.userAchievement.create({ data: { userId, achievementId: achievement.id } });
      return true;
    } catch {
      return false; // 并发下唯一约束兜底
    }
  },

  /** 用户成就墙（字典 + 是否已获得） */
  async listForUser(userId: string) {
    const [dict, mine] = await Promise.all([
      prisma.achievement.findMany(),
      prisma.userAchievement.findMany({ where: { userId }, include: { achievement: true } }),
    ]);
    const mineKeys = new Set(mine.map((m) => m.achievement.key));
    return dict.map((a) => ({
      key: a.key,
      emoji: a.emoji,
      title: a.title,
      got: mineKeys.has(a.key),
    }));
  },
};
