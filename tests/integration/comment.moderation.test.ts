// V12 异步 AI 审核测试：mock DeepSeek 客户端，验证 moderateComment 四分支
// （approve 放行含补通知 / reject 隐藏并通知 / review 转人工 / 缺 key fail-close）。
// 队列入队 mock（本测试直接调 service，不经 worker）。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';

const reviewTextMock = vi.fn();
vi.mock('@/server/moderation/ai', () => ({
  reviewText: (...args: unknown[]) => reviewTextMock(...args),
  ModerationDisabledError: class ModerationDisabledError extends Error {},
  CATEGORY_LABEL: {
    politics: '涉政有害',
    porn: '色情低俗',
    gambling_fraud: '赌博诈骗引流',
    abuse: '辱骂攻击',
    campus_illegal: '违规服务（代考代写等）',
    other: '其他违规',
  },
}));
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
import { ModerationDisabledError } from '@/server/moderation/ai';

const TEST_URL = process.env.DATABASE_URL_TEST!;
const CREATOR_ID = 'creator_test';
const STUDENT_ID = 'stu_test';
const WORK_ID = 'work_test';

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
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function seedComment(overrides: Partial<{ status: string; content: string }> = {}) {
  return prisma.comment.create({
    data: {
      userId: STUDENT_ID,
      workId: WORK_ID,
      content: overrides.content ?? '普通评论内容',
      status: (overrides.status as never) ?? 'VISIBLE',
    },
  });
}

describe('V12 AI 审核（moderateComment）', () => {
  beforeEach(() => {
    reviewTextMock.mockReset();
  });

  it('approve：保持可见 + 记录 AI 复审时间；PENDING（链接）评论放行后补发 owner 通知', async () => {
    reviewTextMock.mockResolvedValue({ verdict: 'approve' });

    // 已可见的：只盖 reviewedAt
    const visible = await seedComment({ status: 'VISIBLE' });
    const r1 = await commentService.moderateComment(visible.id);
    expect(r1).toMatchObject({ verdict: 'approve' });
    const after1 = await prisma.comment.findUniqueOrThrow({ where: { id: visible.id } });
    expect(after1.status).toBe('VISIBLE');
    expect(after1.reviewedAt).toBeTruthy();
    expect(after1.modSource).toBe('AI');

    // PENDING（URL_HOLD）的：放行 + owner 此刻才收到通知
    const before = await prisma.notification.count({
      where: { userId: CREATOR_ID, type: 'WORK_COMMENTED', link: { contains: '' } },
    });
    const held = await seedComment({ status: 'PENDING_REVIEW' });
    await prisma.comment.update({
      where: { id: held.id },
      data: { modSource: 'URL_HOLD' },
    });
    await commentService.moderateComment(held.id);
    const after2 = await prisma.comment.findUniqueOrThrow({ where: { id: held.id } });
    expect(after2.status).toBe('VISIBLE');
    const after = await prisma.notification.count({
      where: { userId: CREATOR_ID, type: 'WORK_COMMENTED', link: { contains: `c=${held.id}` } },
    });
    expect(after - before).toBeGreaterThanOrEqual(1);
  });

  it('reject：隐藏 + modReason 带类别 + 通知作者', async () => {
    reviewTextMock.mockResolvedValue({
      verdict: 'reject',
      category: 'abuse',
      reason: '辱骂攻击',
    });
    const c = await seedComment({ status: 'VISIBLE', content: '你才是小丑' });
    const r = await commentService.moderateComment(c.id);
    expect(r).toMatchObject({ verdict: 'reject' });
    const after = await prisma.comment.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.status).toBe('REJECTED');
    expect(after.modReason).toContain('辱骂攻击');
    const n = await prisma.notification.findFirst({
      where: { userId: STUDENT_ID, type: 'COMMENT_REJECTED' },
    });
    expect(n?.text).toContain('辱骂攻击');
  });

  it('review（不确定）：转 PENDING_REVIEW 静默进人工队列（不通知）', async () => {
    reviewTextMock.mockResolvedValue({ verdict: 'review', reason: '疑似擦边' });
    const c = await seedComment({ status: 'VISIBLE' });
    const before = await prisma.notification.count({ where: { userId: STUDENT_ID } });
    await commentService.moderateComment(c.id);
    const after = await prisma.comment.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.status).toBe('PENDING_REVIEW');
    expect(after.modReason).toContain('疑似擦边');
    const afterN = await prisma.notification.count({ where: { userId: STUDENT_ID } });
    expect(afterN).toBe(before); // 静默
  });

  it('缺 key（确定性故障）：fail-close 转人工，不重试不通知', async () => {
    reviewTextMock.mockRejectedValue(new ModerationDisabledError());
    const c = await seedComment({ status: 'VISIBLE' });
    const r = await commentService.moderateComment(c.id);
    expect(r).toMatchObject({ disabled: true });
    const after = await prisma.comment.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.status).toBe('PENDING_REVIEW');
    expect(after.modSource).toBe('AI_FAIL');
  });

  it('网络类错误：向上抛（由 worker 任务重试）', async () => {
    reviewTextMock.mockRejectedValue(new Error('DeepSeek 502'));
    const c = await seedComment({ status: 'VISIBLE' });
    await expect(commentService.moderateComment(c.id)).rejects.toThrow('502');
    const after = await prisma.comment.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.status).toBe('VISIBLE'); // 未翻状态，等重试
  });

  it('幂等：REJECTED 再审直接跳过', async () => {
    reviewTextMock.mockResolvedValue({ verdict: 'approve' });
    const c = await seedComment({ status: 'REJECTED' });
    const r = await commentService.moderateComment(c.id);
    expect(r).toMatchObject({ skipped: true });
    const after = await prisma.comment.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.status).toBe('REJECTED');
  });

  it('failCloseComment：只翻非 REJECTED 行（已拒的留原样）', async () => {
    const a = await seedComment({ status: 'VISIBLE' });
    const b = await seedComment({ status: 'REJECTED' });
    await commentService.failCloseComment(a.id);
    await commentService.failCloseComment(b.id);
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: a.id } })).status).toBe(
      'PENDING_REVIEW',
    );
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: b.id } })).status).toBe(
      'REJECTED',
    );
  });
});
