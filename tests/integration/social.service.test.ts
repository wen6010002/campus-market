// 阶段 6 测试：收藏/点赞/关注切换幂等 + 计数一致 + 动态推送 + 通知生成。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { prisma } from '@/server/db';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';
import { socialService } from '@/server/services/social.service';
import { notifyService } from '@/server/services/notify.service';

const TEST_URL = process.env.DATABASE_URL_TEST!;
const CREATOR_ID = 'creator_test';
const STUDENT_ID = 'stu_test';
const WORK_ID = 'work_test';

beforeAll(async () => {
  execSync('pnpm exec prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'ignore',
  });
  await flushDb(prisma);
  await seedTestData(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('社交服务（阶段 6）', () => {
  it('收藏：切换幂等 + 计数一致', async () => {
    const before = await prisma.work.findUniqueOrThrow({ where: { id: WORK_ID } });
    const r1 = await socialService.favorite(STUDENT_ID, WORK_ID);
    expect(r1).toEqual({ favorited: true, favs: before.favs + 1 });
    const r2 = await socialService.favorite(STUDENT_ID, WORK_ID); // 幂等：重复收藏不重复计数
    expect(r2.favs).toBe(before.favs + 1);
    const r3 = await socialService.unfavorite(STUDENT_ID, WORK_ID);
    expect(r3).toEqual({ favorited: false, favs: before.favs });
  });

  it('点赞：切换幂等 + 计数一致', async () => {
    const before = await prisma.work.findUniqueOrThrow({ where: { id: WORK_ID } });
    await socialService.like(STUDENT_ID, WORK_ID);
    await socialService.like(STUDENT_ID, WORK_ID); // 幂等
    const after = await prisma.work.findUniqueOrThrow({ where: { id: WORK_ID } });
    expect(after.likes).toBe(before.likes + 1);
    await socialService.unlike(STUDENT_ID, WORK_ID);
    expect((await prisma.work.findUniqueOrThrow({ where: { id: WORK_ID } })).likes).toBe(
      before.likes,
    );
  });

  it('关注：切换幂等 + fans 计数', async () => {
    const r1 = await socialService.follow(STUDENT_ID, CREATOR_ID);
    expect(r1).toEqual({ followed: true, fans: 1 });
    const r2 = await socialService.follow(STUDENT_ID, CREATOR_ID); // 幂等
    expect(r2.fans).toBe(1);
    const r3 = await socialService.unfollow(STUDENT_ID, CREATOR_ID);
    expect(r3).toEqual({ followed: false, fans: 0 });
  });

  it('关注自己 → CONFLICT', async () => {
    await expect(socialService.follow(STUDENT_ID, STUDENT_ID)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('作品上架：生成 Dynamic + 通知粉丝', async () => {
    await socialService.follow(STUDENT_ID, CREATOR_ID);
    await notifyService.onWorkPublished(CREATOR_ID, WORK_ID, '测试作品');
    const dyn = await prisma.dynamic.findFirst({
      where: { creatorId: CREATOR_ID, workId: WORK_ID },
    });
    expect(dyn?.type).toBe('PUBLISH');
    const notif = await prisma.notification.findFirst({
      where: { userId: STUDENT_ID, type: 'FOLLOW_NEW_WORK' },
    });
    expect(notif).toBeTruthy();
  });

  it('关注动态 feed', async () => {
    const feed = await socialService.followingFeed(STUDENT_ID);
    expect(feed.length).toBeGreaterThan(0);
    expect(feed[0].creator.id).toBe(CREATOR_ID);
  });
});
