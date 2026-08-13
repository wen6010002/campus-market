import { prisma } from '../db';
import { appError } from '../lib/errors';
import { DynamicType, NotificationType } from '@/lib/constants';

// 通知服务：写通知、写动态、广播粉丝。
export const notifyService = {
  async createNotification(
    userId: string,
    type: NotificationType,
    text: string,
    link?: string | null,
  ) {
    return prisma.notification.create({ data: { userId, type, text, link: link ?? null } });
  },

  async createDynamic(creatorId: string, type: DynamicType, workId?: string) {
    return prisma.dynamic.create({ data: { creatorId, type, workId: workId ?? null } });
  },

  /** 作品上架：写 Dynamic(PUBLISH) + 通知粉丝 */
  async onWorkPublished(creatorId: string, workId: string, workTitle: string) {
    await prisma.dynamic.create({ data: { creatorId, type: 'PUBLISH', workId } });
    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
      select: { username: true },
    });
    const followers = await prisma.follow.findMany({
      where: { followingId: creatorId },
      select: { followerId: true },
    });
    if (followers.length) {
      await prisma.notification.createMany({
        data: followers.map((f) => ({
          userId: f.followerId,
          type: 'FOLLOW_NEW_WORK' as const,
          text: `你关注的 <b>${creator?.username ?? '创作者'}</b> 发布了新作品《${workTitle}》。`,
          link: `/work/${workId}`,
        })),
      });
    }
  },
};
