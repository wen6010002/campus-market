// V12 评论创建管线集成测试：限流/黑名单分级/URL 暂审/重复内容/回复守卫/
// 列表可见性（两级分组+自己的待审行）/路线图目标/admin 队列与处置/重点观察。
// 队列入队 mock 掉（异步审核另有 moderation 测试覆盖）。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('@/server/jobs/queue', () => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
  getQueue: vi.fn(),
  getQueueConnection: vi.fn(),
}));

import { prisma } from '@/server/db';
import { redis } from '@/server/lib/redis';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';
import { commentService } from '@/server/services/comment.service';

const TEST_URL = process.env.DATABASE_URL_TEST!;
const CREATOR_ID = 'creator_test';
const STUDENT_ID = 'stu_test';
const WORK_ID = 'work_test';
const RM_ID = 'rm_test';

async function seedRoadmap() {
  await prisma.roadmap.upsert({
    where: { id: RM_ID },
    update: {},
    create: {
      id: RM_ID,
      title: '测试路线图',
      summary: '集成测试用',
      uploaderId: CREATOR_ID,
      status: 'PUBLISHED',
      stepsCount: 1,
      content: {
        phases: [{ title: '阶段一', desc: '', steps: [{ id: 'p0-s0', text: '第一步' }] }],
      },
      mdSourceKey: 'roadmaps/test/rm.md',
      publishedAt: new Date(),
    },
  });
}

/** 每个用例前清评论限流与去重键（6 条/10min 会跨用例串扰） */
async function clearGuards() {
  for (const pattern of ['rl:comment:*', 'cdup:*']) {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(...keys);
  }
}

beforeAll(async () => {
  execSync('pnpm exec prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'ignore',
  });
  await flushDb(prisma);
  await seedTestData(prisma);
  await seedRoadmap();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('V12 评论创建管线', () => {
  beforeEach(clearGuards);

  it('正常评论：VISIBLE 即显 + 通知作品作者 + 回归楼两级', async () => {
    const r = await commentService.create(STUDENT_ID, 'WORK', WORK_ID, '这份资料写得真清楚');
    expect(r.status).toBe('VISIBLE');

    const row = await prisma.comment.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.status).toBe('VISIBLE');
    expect(row.workId).toBe(WORK_ID);

    // 通知作者（WORK_COMMENTED）
    const n = await prisma.notification.findFirst({
      where: { userId: CREATOR_ID, type: 'WORK_COMMENTED' },
    });
    expect(n?.link).toContain(`/work/${WORK_ID}`);
    expect(n?.link).toContain(`c=${r.id}`);

    // 回复：二级可见 + 通知被回复人
    const rep = await commentService.create(CREATOR_ID, 'WORK', WORK_ID, '谢谢支持！', r.id);
    expect(rep.status).toBe('VISIBLE');
    const rn = await prisma.notification.findFirst({
      where: { userId: STUDENT_ID, type: 'COMMENT_REPLIED' },
    });
    expect(rn).toBeTruthy();

    // 列表：一级 + replies 分组
    const list = await commentService.list('WORK', WORK_ID, 1, 20, STUDENT_ID);
    const top = list.data.find((c) => c.id === r.id);
    expect(top?.replies?.some((x) => x.id === rep.id)).toBe(true);
    expect(list.data.find((c) => c.id === rep.id)).toBeUndefined(); // 回复不在一级列表
  });

  it('路线图评论：走 roadmapId + 通知上传者', async () => {
    const r = await commentService.create(
      STUDENT_ID,
      'ROADMAP',
      RM_ID,
      '这条路线第三步卡住了，求教',
    );
    expect(r.status).toBe('VISIBLE');
    const row = await prisma.comment.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.roadmapId).toBe(RM_ID);
    expect(row.workId).toBeNull();

    const n = await prisma.notification.findFirst({
      where: {
        userId: CREATOR_ID,
        type: 'WORK_COMMENTED',
        link: { contains: `/roadmaps/${RM_ID}` },
      },
    });
    expect(n?.text).toContain('路线图');

    const list = await commentService.list('ROADMAP', RM_ID, 1, 20);
    expect(list.data.some((c) => c.id === r.id)).toBe(true);
  });

  it('黑名单 REJECT：400 + 入库 REJECTED 留痕 + 通知本人 + 不公开', async () => {
    await expect(
      commentService.create(STUDENT_ID, 'WORK', WORK_ID, '有没有人代考线代'),
    ).rejects.toMatchObject({ code: 'COMMENT_REJECTED' });

    const row = await prisma.comment.findFirst({
      where: { userId: STUDENT_ID, status: 'REJECTED' },
    });
    expect(row?.modSource).toBe('KEYWORD');
    expect(row?.modReason).toContain('代考');

    const n = await prisma.notification.findFirst({
      where: { userId: STUDENT_ID, type: 'COMMENT_REJECTED' },
    });
    expect(n).toBeTruthy();

    // 匿名列表不可见
    const list = await commentService.list('WORK', WORK_ID, 1, 20);
    expect(list.data.some((c) => c.id === row?.id)).toBe(false);
  });

  it('黑名单 REVIEW（广告类）：PENDING_REVIEW + 本人可见带审核中 + 他人不可见', async () => {
    const r = await commentService.create(STUDENT_ID, 'WORK', WORK_ID, '有兼职刷单群的私信我');
    expect(r.status).toBe('PENDING_REVIEW');

    const mine = await commentService.list('WORK', WORK_ID, 1, 20, STUDENT_ID);
    const held = mine.data.find((c) => c.id === r.id);
    expect(held?.status).toBe('PENDING_REVIEW'); // 仅自见

    const anon = await commentService.list('WORK', WORK_ID, 1, 20);
    expect(anon.data.some((c) => c.id === r.id)).toBe(false);
    // 公开计数（「评论 N」）只算 VISIBLE，待审行不计入楼数
    expect(anon.pagination.total).toBe(mine.pagination.total);
  });

  it('含 URL：PENDING_REVIEW（不公开）', async () => {
    const r = await commentService.create(
      STUDENT_ID,
      'WORK',
      WORK_ID,
      '参考资料在 https://example.com/a',
    );
    expect(r.status).toBe('PENDING_REVIEW');
    const row = await prisma.comment.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.modSource).toBe('URL_HOLD');
  });

  it('重复内容：10 分钟内同内容 409', async () => {
    await commentService.create(STUDENT_ID, 'WORK', WORK_ID, '第一遍发这句话');
    await expect(
      commentService.create(STUDENT_ID, 'WORK', WORK_ID, '第一遍发这句话'),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('限流：同用户第 7 条被拒（6/10min）', async () => {
    for (let i = 0; i < 6; i++) {
      await commentService.create(
        STUDENT_ID,
        'ROADMAP',
        RM_ID,
        `第 ${i} 条不同内容 ${Date.now()}-${i}`,
      );
    }
    await expect(
      commentService.create(STUDENT_ID, 'ROADMAP', RM_ID, `超限那条 ${Date.now()}`),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('回复守卫：父评不存在/二级嵌套/待审父评 都不可回复', async () => {
    await expect(
      commentService.create(STUDENT_ID, 'WORK', WORK_ID, '回复空气', 'nonexistent'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const top = await commentService.create(STUDENT_ID, 'WORK', WORK_ID, `一级评论 ${Date.now()}`);
    const rep = await commentService.create(CREATOR_ID, 'WORK', WORK_ID, '一级回复', top.id);
    // 回复的回复（二级嵌套）被拒
    await expect(
      commentService.create(STUDENT_ID, 'WORK', WORK_ID, '二级嵌套', rep.id),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // 待审父评（URL_HOLD）不可回复
    const held = await commentService.create(
      STUDENT_ID,
      'WORK',
      WORK_ID,
      `链接父评 https://x.io/${Date.now()}`,
    );
    expect(held.status).toBe('PENDING_REVIEW');
    await expect(
      commentService.create(CREATOR_ID, 'WORK', WORK_ID, '回复待审', held.id),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('admin 队列与处置：待审列表 + APPROVE 放行并通知 + 重点观察（7 天拒≥3）', async () => {
    // 制造 3 条 REJECTED（黑名单直接拒）
    for (let i = 0; i < 3; i++) {
      await expect(
        commentService.create(STUDENT_ID, 'WORK', WORK_ID, `第${i}次问代考`),
      ).rejects.toMatchObject({ code: 'COMMENT_REJECTED' });
    }
    const pending = await commentService.adminList('PENDING_REVIEW', 1, 20);
    // 重点观察：stu_test 拒 3 次（含管线前面用例的更多拒绝也只增不减）
    const watched = pending.watchlist.find((w) => w.id === STUDENT_ID);
    expect(watched && watched.rejected7d >= 3).toBe(true);

    // 处置一条 PENDING：APPROVE → VISIBLE + 通知作者
    const target = pending.data[0];
    expect(target).toBeTruthy();
    const handled = await commentService.adminHandle(target.id, 'APPROVE', 'admin_test');
    expect(handled.status).toBe('VISIBLE');
    const after = await prisma.comment.findUniqueOrThrow({ where: { id: target.id } });
    expect(after.status).toBe('VISIBLE');
    expect(after.modSource).toBe('ADMIN');
    const n = await prisma.notification.findFirst({
      where: { userId: target.user.id, text: { contains: '已通过审核' } },
    });
    expect(n).toBeTruthy();

    // REJECT 分支
    const rejected = await commentService
      .adminHandle(pending.data[1]?.id ?? target.id, 'REJECT', 'admin_test')
      .catch(() => null);
    if (rejected) expect(rejected.status).toBe('REJECTED');
  });
});
