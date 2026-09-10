// 路线图服务测试：上传（ADMIN 直发/学生凭证校验/md 解析/资料关联）、打卡、进度连续天数。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { prisma } from '@/server/db';
import { redis } from '@/server/lib/redis';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';
import { roadmapService } from '@/server/services/roadmap.service';
import type { RoadmapInput } from '@/lib/zod/roadmap';

vi.mock('@/server/storage/minio', () => ({
  getObjectText: vi.fn(),
  objectExists: vi.fn(async () => true),
  presignGet: vi.fn(async () => 'https://mock.local/get'),
  presignGetInline: vi.fn(async () => 'https://mock.local/inline'),
}));

import { getObjectText } from '@/server/storage/minio';

const TEST_URL = process.env.DATABASE_URL_TEST!;
// create 限流 5 次/小时/用户：ADMIN 路径与学生路径分散到两个用户
const ADMIN_ACTOR = 'stu_test';
const STUDENT_ACTOR = 'creator_test';

// 3 步 2 阶段：stepId = p0-s0 / p0-s1 / p1-s0
const MD = [
  '## 阶段一：基础',
  '打好基础。',
  '- [ ] 学完变量',
  '  每天 2 小时',
  '- [ ] 学完循环',
  '## 阶段二：项目',
  '- [ ] 做一个小项目',
].join('\n');

const baseInput = (over: Partial<RoadmapInput> = {}): RoadmapInput => ({
  title: '测试路线图',
  summary: '测试摘要',
  category: 'OTHER',
  coverIcon: '🗺',
  mdSourceKey: 'roadmaps/test/x.md',
  workIds: [],
  ...over,
});

beforeAll(async () => {
  execSync('pnpm exec prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'ignore',
  });
  await flushDb(prisma);
  await seedTestData(prisma);
  // flushDb 刻意不动限流 key；create 限流 5 次/时/用户，跨文件/重跑会残留计数，先清掉本文件用到的
  await redis.del(['rl:roadmap:create:stu_test', 'rl:roadmap:create:creator_test']);
  vi.mocked(getObjectText).mockResolvedValue(MD);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('路线图上传', () => {
  it('ADMIN 直发：PUBLISHED + stepsCount + 关联资料写入', async () => {
    const r = await roadmapService.create(
      ADMIN_ACTOR,
      'ADMIN',
      baseInput({ workIds: ['work_test'] }),
    );
    expect(r.status).toBe('PUBLISHED');
    const rm = await prisma.roadmap.findUniqueOrThrow({ where: { id: r.id } });
    expect(rm.stepsCount).toBe(3);
    expect(rm.publishedAt).not.toBeNull();
    const links = await prisma.roadmapWorkLink.findMany({ where: { roadmapId: r.id } });
    expect(links).toHaveLength(1);
    expect(links[0].workId).toBe('work_test');
  });

  it('学生缺学生证/经历 → VALIDATION', async () => {
    await expect(
      roadmapService.create(STUDENT_ACTOR, 'STUDENT', baseInput()),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  it('md 拉取失败 → NOT_FOUND', async () => {
    vi.mocked(getObjectText).mockRejectedValueOnce(new Error('missing'));
    await expect(
      roadmapService.create(
        STUDENT_ACTOR,
        'STUDENT',
        baseInput({ credentialKey: 'credentials/x.jpg', experience: '大二学生' }),
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('关联未上架作品 → VALIDATION', async () => {
    await prisma.work.update({ where: { id: 'work_test' }, data: { status: 'DRAFT' } });
    await expect(
      roadmapService.create(
        STUDENT_ACTOR,
        'STUDENT',
        baseInput({
          workIds: ['work_test'],
          credentialKey: 'credentials/x.jpg',
          experience: '大二学生',
        }),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await prisma.work.update({ where: { id: 'work_test' }, data: { status: 'PUBLISHED' } });
  });
});

describe('打卡与进度', () => {
  let rmId: string;

  beforeAll(async () => {
    const r = await roadmapService.create(
      STUDENT_ACTOR,
      'ADMIN',
      baseInput({ title: '打卡用路线图' }),
    );
    rmId = r.id;
  });

  it('非法 stepId → VALIDATION', async () => {
    await expect(
      roadmapService.toggleCheck(STUDENT_ACTOR, rmId, 'p9-s9', true),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('勾选落行；重复勾选幂等；取消清行', async () => {
    await roadmapService.toggleCheck(STUDENT_ACTOR, rmId, 'p0-s0', true);
    expect(
      await prisma.roadmapCheck.count({ where: { userId: STUDENT_ACTOR, roadmapId: rmId } }),
    ).toBe(1);
    await roadmapService.toggleCheck(STUDENT_ACTOR, rmId, 'p0-s0', true); // 幂等
    expect(
      await prisma.roadmapCheck.count({ where: { userId: STUDENT_ACTOR, roadmapId: rmId } }),
    ).toBe(1);
    await roadmapService.toggleCheck(STUDENT_ACTOR, rmId, 'p0-s0', false);
    expect(
      await prisma.roadmapCheck.count({ where: { userId: STUDENT_ACTOR, roadmapId: rmId } }),
    ).toBe(0);
  });

  it('进度（V12 站内口径）：streak 读账本；取消勾选不回滚（修复旧缺陷）', async () => {
    // 上一用例的 toggleCheck 已写今天的账本行——先清，本用例自建三天账本
    await prisma.dailyCheckin.deleteMany({ where: { userId: STUDENT_ACTOR } });
    const day = 86400_000;
    const mk = (i: number, ago: number) =>
      prisma.roadmapCheck.create({
        data: {
          userId: STUDENT_ACTOR,
          roadmapId: rmId,
          stepId: `p1-s${i}`,
          phaseIdx: 1,
          stepIdx: i,
          createdAt: new Date(Date.now() - ago),
        },
      });
    await mk(0, 0);
    await mk(1, day);
    await mk(2, 2 * day);

    // 账本：今天 3 连、昨天 2、前天 1（toggleCheck 写入的等价形态）
    const { dayCn8 } = await import('@/lib/day');
    const today = dayCn8(new Date());
    const yesterday = dayCn8(new Date(Date.now() - day));
    const dayBefore = dayCn8(new Date(Date.now() - 2 * day));
    await prisma.dailyCheckin.create({
      data: { userId: STUDENT_ACTOR, day: dayBefore, streakDays: 1 },
    });
    await prisma.dailyCheckin.create({
      data: { userId: STUDENT_ACTOR, day: yesterday, streakDays: 2 },
    });
    await prisma.dailyCheckin.create({
      data: { userId: STUDENT_ACTOR, day: today, streakDays: 3 },
    });

    const p = await roadmapService.progress(STUDENT_ACTOR, rmId);
    expect(p.streakDays).toBe(3); // 账本单一事实源
    expect(Object.keys(p.byDay)).toHaveLength(3); // 热力图仍按勾选步数按日聚合
    expect(p.totalChecked).toBe(3);

    // V12 行为变化：取消今天的勾选不再追溯抹掉打卡（账本行不回滚）
    await prisma.roadmapCheck.deleteMany({
      where: { userId: STUDENT_ACTOR, roadmapId: rmId, stepId: 'p1-s0' },
    });
    const p2 = await roadmapService.progress(STUDENT_ACTOR, rmId);
    expect(p2.streakDays).toBe(3); // 仍 3（旧实现会掉到 2）
    expect(p2.byDay[today]).toBeGreaterThanOrEqual(1); // 账本日兜底亮一格
  });

  it('按日聚合用 UTC+8 口径：UTC 16:30 计入次日', async () => {
    const ts = new Date('2026-01-01T16:30:00.000Z'); // 北京时间 2026-01-02 00:30
    await prisma.roadmapCheck.create({
      data: {
        userId: ADMIN_ACTOR,
        roadmapId: rmId,
        stepId: 'p0-s1',
        phaseIdx: 0,
        stepIdx: 1,
        createdAt: ts,
      },
    });
    const p = await roadmapService.progress(ADMIN_ACTOR, rmId);
    const expectedKey = new Date(ts.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
    expect(expectedKey).toBe('2026-01-02');
    expect(p.byDay['2026-01-02']).toBe(1);
  });
});
