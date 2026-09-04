// V8 荣耀引擎集成测试：授予/判定/通知、限时过期与卫冕、佩戴上限、弹层、
// 评论区徽章、收藏栏增强、赞藏通知防轰炸、周榜授予、事件端到端触发。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { prisma } from '@/server/db';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';

vi.mock('@/server/storage/minio', () => ({
  presignPut: vi.fn(async () => 'https://mock.local/put'),
  presignGet: vi.fn(async () => 'https://mock.local/get'),
  presignGetInline: vi.fn(async () => 'https://mock.local/inline'),
  getObjectText: vi.fn(async () => '# 全文'),
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  S3_BUCKET: 'campus-market',
}));

const TEST_URL = process.env.DATABASE_URL_TEST!;
const AUTHOR = 'creator_test'; // seed 已建
const BUYER = 'stu_test'; // seed 已建
const OTHER = 'ach_other';

const { achievementService, PIN_LIMIT } = await import('@/server/services/achievement.service');
const { ratingService } = await import('@/server/services/rating.service');
const { socialService } = await import('@/server/services/social.service');
const { orderService } = await import('@/server/services/order.service');
const { redis } = await import('@/server/lib/redis');

async function mkWork(id: string, authorId: string, extra: Record<string, any> = {}) {
  await prisma.work.create({
    data: {
      id,
      authorId,
      title: `作品 ${id}`,
      description: '成就测试作品',
      course: '测试课程',
      fileType: 'PDF',
      fileKey: `works/${id}.pdf`,
      fileSize: 1024,
      isFree: true,
      status: 'PUBLISHED',
      copyrightAccepted: true,
      previewToc: [],
      publishedAt: new Date(),
      ...extra,
    },
  });
}

async function grantN(userId: string, n: number, prefix = 'ACH') {
  // 直接造 n 个永久成就解锁（借 HELP_10..HELP_10000 阶梯凑数）
  const keys = ['HELP_10', 'HELP_50', 'HELP_100', 'HELP_500', 'HELP_1000', 'HELP_10000'];
  for (let i = 0; i < n && i < keys.length; i++) {
    await achievementService.grant(userId, keys[i] as any);
  }
}

beforeAll(async () => {
  execSync('pnpm exec prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'ignore',
  });
  await flushDb(prisma);
  await seedTestData(prisma);
  // 赞/藏通知的 SETNX key 带日期（86400 TTL），跨轮测试残留会让通知判重误判 —— 清掉
  const ntKeys = await redis.keys('nt:*');
  if (ntKeys.length) await redis.del(...ntKeys);
  await prisma.user.create({
    data: {
      id: OTHER,
      email: 'other@szu.edu.cn',
      username: '其他用户',
      passwordHash: 'hash',
      passwordPepper: 'seed',
      role: 'STUDENT',
    },
  });
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.$disconnect();
});

describe('授予与判定（数量阶梯）', () => {
  it('checkHelp：downloads=12 → HELP_10 解锁 + ACHIEVEMENT 通知；HELP_50 不解锁', async () => {
    await mkWork('ach_w1', AUTHOR, { downloads: 12 });
    await achievementService.checkHelp(AUTHOR);
    const got = await prisma.userAchievement.findMany({
      where: { userId: AUTHOR, achievement: { key: { in: ['HELP_10', 'HELP_50'] } } },
      include: { achievement: true },
    });
    const keys = got.map((g) => g.achievement.key);
    expect(keys).toContain('HELP_10');
    expect(keys).not.toContain('HELP_50');
    // 通知：ACHIEVEMENT 类型 + popped=false
    const note = await prisma.notification.findFirst({
      where: { userId: AUTHOR, type: 'ACHIEVEMENT' },
    });
    expect(note?.text).toContain('微光初现');
    const ua = await prisma.userAchievement.findFirst({
      where: { userId: AUTHOR, achievement: { key: 'HELP_10' } },
    });
    expect(ua?.popped).toBe(false);
  });

  it('幂等：重复 checkHelp 不重复授予、不重复通知', async () => {
    const before = await prisma.userAchievement.count({ where: { userId: AUTHOR } });
    const notesBefore = await prisma.notification.count({
      where: { userId: AUTHOR, type: 'ACHIEVEMENT' },
    });
    await achievementService.checkHelp(AUTHOR);
    await achievementService.checkHelp(AUTHOR);
    expect(await prisma.userAchievement.count({ where: { userId: AUTHOR } })).toBe(before);
    expect(
      await prisma.notification.count({ where: { userId: AUTHOR, type: 'ACHIEVEMENT' } }),
    ).toBe(notesBefore);
  });

  it('checkLikes / checkFavs 阶梯', async () => {
    await prisma.work.update({ where: { id: 'ach_w1' }, data: { likes: 10, favs: 100 } });
    await achievementService.checkLikes(AUTHOR);
    await achievementService.checkFavs(AUTHOR);
    const got = await prisma.userAchievement.findMany({
      where: { userId: AUTHOR },
      include: { achievement: true },
    });
    const keys = got.map((g) => g.achievement.key);
    expect(keys).toContain('LIKES_10');
    expect(keys).not.toContain('LIKES_100');
    expect(keys).toContain('FAVS_10');
    expect(keys).toContain('FAVS_100');
  });

  it('checkWorks：首个过审作品', async () => {
    await achievementService.checkWorks(AUTHOR);
    const got = await prisma.userAchievement.findFirst({
      where: { userId: AUTHOR, achievement: { key: 'FIRST_WORK' } },
    });
    expect(got).toBeTruthy();
  });
});

describe('限时成就：过期 / 卫冕', () => {
  it('过期后 listHonor active=false；不可佩戴；再授予（卫冕）重新点亮', async () => {
    const expired = new Date(Date.now() - 3600_000);
    await achievementService.grant(OTHER, 'WEEKLY_HOT', { expiresAt: expired });
    const honor = await achievementService.listHonor(OTHER);
    const wh = honor.items.find((i) => i.key === 'WEEKLY_HOT')!;
    expect(wh.got).toBe(true);
    expect(wh.active).toBe(false);
    // 过期不可佩戴
    const r = await achievementService.pin(OTHER, 'WEEKLY_HOT', true);
    expect(r.pinned).toBe(false);
    // 卫冕：新 expiresAt → 重新点亮 + 通知
    const fresh = new Date(Date.now() + 7 * 86400_000);
    const ok = await achievementService.grant(OTHER, 'WEEKLY_HOT', { expiresAt: fresh });
    expect(ok).toBe(true);
    const honor2 = await achievementService.listHonor(OTHER);
    expect(honor2.items.find((i) => i.key === 'WEEKLY_HOT')!.active).toBe(true);
  });
});

describe('佩戴栏与名字徽章', () => {
  it('pin/unpin：≤5 枚上限、listPinned 按佩戴序、超限抛 VALIDATION', async () => {
    // OTHER 已有 WEEKLY_HOT（active）。再造 6 枚永久（第 6 枚用于测超限）
    await grantN(OTHER, 6);
    // 佩戴 5 枚
    for (const k of ['HELP_10', 'HELP_50', 'HELP_100', 'HELP_500', 'HELP_1000']) {
      const r = await achievementService.pin(OTHER, k as any, true);
      expect(r.pinned).toBe(true);
    }
    const pins = await achievementService.listPinned(OTHER);
    expect(pins.length).toBe(PIN_LIMIT);
    // 第 6 枚超限
    await expect(achievementService.pin(OTHER, 'HELP_10000', true)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    // inlineBadges：佩戴第一枚
    const badges = await achievementService.inlineBadges([OTHER, AUTHOR]);
    expect(badges[OTHER]?.key).toBe('HELP_10');
    expect(badges[AUTHOR]).toBeUndefined();
    // 卸下恢复
    await achievementService.pin(OTHER, 'HELP_10', false);
    expect((await achievementService.listPinned(OTHER)).length).toBe(4);
  });
});

describe('解锁弹层', () => {
  it('popNext → confirmPop → 取下一条 / 空', async () => {
    const first = await achievementService.popNext(AUTHOR);
    expect(first).toBeTruthy();
    expect(first!.title).toBe('微光初现');
    await achievementService.confirmPop(first!.id, AUTHOR);
    const second = await achievementService.popNext(AUTHOR);
    expect(second?.id).not.toBe(first!.id);
    // 非本人确认无效
    const steal = await achievementService.popNext(AUTHOR);
    if (steal) await achievementService.confirmPop(steal.id, OTHER);
    expect(await achievementService.popNext(AUTHOR)).toBeTruthy();
  });
});

describe('赞藏通知防轰炸 + 事件端到端', () => {
  it('两个用户点赞同一作品 → 作者只收 1 条通知（每作品每日）', async () => {
    await socialService.like(BUYER, 'ach_w1');
    await socialService.like(OTHER, 'ach_w1');
    await new Promise((r) => setTimeout(r, 300)); // fire-and-forget 落地
    const notes = await prisma.notification.findMany({
      where: { userId: AUTHOR, type: 'SYSTEM', text: { contains: '点赞' } },
    });
    expect(notes.length).toBe(1);
    // likes 轴成就已触发（BUYER+OTHER 两赞 = 12 ≥ 10 → LIKES_10，前面已授幂等）
    expect((await prisma.work.findUniqueOrThrow({ where: { id: 'ach_w1' } })).likes).toBe(12);
  });

  it('免费下载端到端：首次下载 → 作者 help 成就判定异步触发', async () => {
    const author2 = OTHER;
    await mkWork('ach_w2', author2, { downloads: 9 }); // 差 1 次到 10
    await orderService.download(BUYER, 'ach_w2');
    await new Promise((r) => setTimeout(r, 400));
    const got = await prisma.userAchievement.findFirst({
      where: { userId: author2, achievement: { key: 'HELP_10' } },
    });
    expect(got).toBeTruthy();
    // 计数 +1 → 10
    expect((await prisma.work.findUniqueOrThrow({ where: { id: 'ach_w2' } })).downloads).toBe(10);
  });
});

describe('收藏栏增强', () => {
  it('置顶排序 + 已下载标记 + 下架作品灰显字段', async () => {
    await socialService.favorite(BUYER, 'ach_w1');
    await socialService.favorite(BUYER, 'ach_w2');
    await orderService.download(BUYER, 'ach_w1'); // w1 已下载
    // w2 下架
    await prisma.work.update({ where: { id: 'ach_w2' }, data: { status: 'TAKEN_DOWN' } });
    // 置顶 w2（下架也能置顶，展示层灰显）
    await socialService.favoritePin(BUYER, 'ach_w2', true);
    const favs: any = await socialService.myFavorites(BUYER, 1, 20);
    const w2 = favs.data.find((w: any) => w.id === 'ach_w2');
    const w1 = favs.data.find((w: any) => w.id === 'ach_w1');
    expect(favs.data[0].id).toBe('ach_w2'); // 置顶在前
    expect(w2.pinned).toBe(true);
    expect(w2.workStatus).toBe('TAKEN_DOWN');
    expect(w1.downloaded).toBe(true);
    expect(w2.downloaded).toBe(true); // 下架前 BUYER 已下载过（端到端用例），标记如实保留
  });
});

describe('周榜授予（worker）', () => {
  it('grantLeaderboard：近期有下载的作者 TopN 获限时勋章', async () => {
    const granted = await achievementService.grantLeaderboard('WEEKLY_HOT', 3, 7);
    expect(granted).toBeGreaterThanOrEqual(1);
    const wh = await prisma.userAchievement.findFirst({
      where: { achievement: { key: 'WEEKLY_HOT' }, expiresAt: { gt: new Date() } },
    });
    expect(wh).toBeTruthy();
  });
});

describe('展示成就（featured）：inline 位唯一一枚，自选优先', () => {
  it('设为展示 → inlineBadges 优先返回它（覆盖佩戴第一枚）；换设另一枚保持唯一；未解锁拒绝', async () => {
    // OTHER 已佩戴 HELP_10（佩戴组用例后剩 4 枚佩戴，HELP_10 已卸下——重戴保底）
    await achievementService.pin(OTHER, 'HELP_10', true);
    // 未解锁拒绝
    const b3 = await prisma.user.create({
      data: {
        id: 'ach_b3',
        email: 'b3@szu.edu.cn',
        username: '第三人',
        passwordHash: 'hash',
        passwordPepper: 'seed',
        role: 'STUDENT',
      },
    });
    await expect(achievementService.setFeatured(b3.id, 'HELP_10', true)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    // 默认：回落佩戴第一枚（pinnedAt 最早 = 佩戴组用例中最先佩戴的 HELP_50；HELP_10 刚重戴最晚）
    let badges = await achievementService.inlineBadges([OTHER]);
    expect(badges[OTHER].key).toBe('HELP_50');
    // 设 HELP_100 为展示成就 → inline 变为它
    await achievementService.setFeatured(OTHER, 'HELP_100', true);
    badges = await achievementService.inlineBadges([OTHER]);
    expect(badges[OTHER].key).toBe('HELP_100');
    expect(badges[OTHER].description).toContain('100');
    // 换设 HELP_500 → 唯一（HELP_100 不再 featured）
    await achievementService.setFeatured(OTHER, 'HELP_500', true);
    badges = await achievementService.inlineBadges([OTHER]);
    expect(badges[OTHER].key).toBe('HELP_500');
    const feats = await prisma.userAchievement.count({ where: { userId: OTHER, featured: true } });
    expect(feats).toBe(1);
    // 取消 → 回落佩戴第一枚（pinnedAt 最早 = HELP_50）
    await achievementService.setFeatured(OTHER, 'HELP_500', false);
    badges = await achievementService.inlineBadges([OTHER]);
    expect(badges[OTHER].key).toBe('HELP_50');
  });

  it('作品列表/详情的 author.badge 联动（卡片作者名旁）', async () => {
    // AUTHOR 已有多枚（含 HELP_10），未佩戴未设展示 → null
    const { workService } = await import('@/server/services/work.service');
    let list: any = await workService.list({ page: 1, pageSize: 50, sort: 'complex' } as any);
    let mine = list.data.find((w: any) => w.author.id === AUTHOR);
    expect(mine.author.badge ?? null).toBeNull();
    // 设展示成就 → 列表回填（list 有 30s 缓存，先清）
    await achievementService.setFeatured(AUTHOR, 'HELP_10', true);
    const { cacheDelByPattern } = await import('@/server/lib/cache');
    await cacheDelByPattern('works:list:*');
    list = await workService.list({ page: 1, pageSize: 50, sort: 'complex' } as any);
    mine = list.data.find((w: any) => w.author.id === AUTHOR);
    expect(mine.author.badge.key).toBe('HELP_10');
    // 详情同样（带 viewerId 不走缓存）
    const detail: any = await workService.get('ach_w1', BUYER);
    expect(detail.author.badge?.key).toBe('HELP_10');
    // 取消展示恢复（顺手清理状态）
    await achievementService.setFeatured(AUTHOR, 'HELP_10', false);
    await cacheDelByPattern('works:list:*');
  });
});

describe('评论区徽章回填', () => {
  it('评价列表 user.badge = 佩戴第一枚', async () => {
    // BUYER 给 ach_w1 写一条评价（已下载 ✓ 有权限）
    await ratingService.create(BUYER, 'ach_w1', { stars: 5, text: '好资料', tags: [] });
    // BUYER 无佩戴 → badge null
    const list: any = await ratingService.list('ach_w1', 'new', 1, 20);
    expect(list.data[0].user.badge ?? null).toBeNull();
    // 给 BUYER 授+佩戴一枚
    await achievementService.grant(BUYER, 'HELP_10');
    await achievementService.pin(BUYER, 'HELP_10', true);
    const list2: any = await ratingService.list('ach_w1', 'new', 1, 20);
    expect(list2.data[0].user.badge?.key).toBe('HELP_10');
  });
});
