// V7 集成测试：PAYMENT_MODE=off 全站免费 —— 下单接口封存、付费作品完整预览、
// 登录即可免费下载（含下载数计数）、详情 myAccess、恢复付费后付费墙回归（开关双向）。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { prisma } from '@/server/db';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';

vi.mock('@/server/storage/minio', () => ({
  presignPut: vi.fn(async () => 'https://mock.local/put'),
  presignGet: vi.fn(async () => 'https://mock.local/get'),
  presignGetInline: vi.fn(async () => 'https://mock.local/inline'),
  getObjectText: vi.fn(async () => '# 全文内容'),
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  S3_BUCKET: 'campus-market',
}));

const TEST_URL = process.env.DATABASE_URL_TEST!;
const BUYER = 'stu_test';
const BUYER2 = 'stu_free_b2';
const CREATOR = 'creator_test';
const WORK = 'paid_work_free_mode'; // 付费作品（off 前价格 9.9，带试读副本）

// service 为模块单例，但 paymentsEnabled() 惰性读 env —— stubEnv 后调用即生效
const { workService } = await import('@/server/services/work.service');
const { orderService } = await import('@/server/services/order.service');

beforeAll(async () => {
  execSync('pnpm exec prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'ignore',
  });
  await flushDb(prisma);
  await seedTestData(prisma);
  await prisma.user.create({
    data: {
      id: BUYER2,
      email: 'b2@szu.edu.cn',
      username: 'free_b2',
      passwordHash: 'hash',
      passwordPepper: 'seed',
      role: 'STUDENT',
    },
  });
  await prisma.work.create({
    data: {
      id: WORK,
      authorId: CREATOR,
      title: '付费精品·免费模式测试',
      description: 'V7 免费模式测试作品',
      course: '测试课程',
      fileType: 'PDF',
      fileKey: 'works/free-mode.pdf',
      previewKey: 'works/free-mode-sample.pdf',
      fileSize: 2048,
      isFree: false,
      price: 9.9,
      status: 'PUBLISHED',
      copyrightAccepted: true,
      previewToc: ['第一章'],
      publishedAt: new Date(),
    },
  });
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.$disconnect();
});

describe('PAYMENT_MODE=off 全站免费（V7）', () => {
  it('下单接口封存：createOrder / pay 一律拒绝', async () => {
    vi.stubEnv('PAYMENT_MODE', 'off');
    await expect(orderService.createOrder(BUYER, WORK, 'ALIPAY')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    const pending = await prisma.order.create({
      data: {
        workId: WORK,
        buyerId: BUYER,
        amount: 9.9,
        platformFee: 0.99,
        creatorAmount: 8.91,
        payMethod: 'ALIPAY',
        payStatus: 'PENDING',
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });
    await expect(orderService.pay(pending.id, BUYER)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await prisma.order.delete({ where: { id: pending.id } });
  });

  it('付费作品完整预览：匿名也拿 full（不再是试读 sample）', async () => {
    vi.stubEnv('PAYMENT_MODE', 'off');
    const r = await workService.getPreview(WORK, undefined, '9.9.9.9');
    expect(r.mode).toBe('full');
    expect(r.url).toBeTruthy();
  });

  it('登录即可免费下载，且首次下载计入下载数（激励核心指标）', async () => {
    vi.stubEnv('PAYMENT_MODE', 'off');
    const before = await prisma.work.findUniqueOrThrow({ where: { id: WORK } });
    const r = await orderService.download(BUYER2, WORK);
    expect(r.url).toBeTruthy();
    const after = await prisma.work.findUniqueOrThrow({ where: { id: WORK } });
    expect(after.downloads).toBe(before.downloads + 1);
    expect(
      await prisma.download.findUnique({
        where: { workId_userId: { workId: WORK, userId: BUYER2 } },
      }),
    ).toBeTruthy();
    // 二次下载幂等，不重复计数
    await orderService.download(BUYER2, WORK);
    const again = await prisma.work.findUniqueOrThrow({ where: { id: WORK } });
    expect(again.downloads).toBe(before.downloads + 1);
  });

  it('详情对未购买用户回 myAccess=true / previewOnly=false / hasSample=false', async () => {
    vi.stubEnv('PAYMENT_MODE', 'off');
    const d = (await workService.get(WORK, BUYER)) as Record<string, boolean>;
    expect(d.myAccess).toBe(true);
    expect(d.previewOnly).toBe(false);
    expect(d.hasSample).toBe(false);
  });

  it('开关双向：恢复 mock 后付费墙与试读回归', async () => {
    vi.stubEnv('PAYMENT_MODE', 'mock');
    // 未购用户预览回到 sample（试读副本）
    const r = await workService.getPreview(WORK, undefined, '8.8.8.8');
    expect(r.mode).toBe('sample');
    // 无订单无下载记录的用户被付费墙拦下
    await expect(orderService.download(BUYER, WORK)).rejects.toMatchObject({
      code: 'PAYMENT_REQUIRED',
    });
  });
});
