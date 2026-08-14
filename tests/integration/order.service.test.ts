// 阶段 4 测试：下单(mock)/支付/回调幂等/下载权限/收益流水。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { prisma } from '@/server/db';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';
import { orderService } from '@/server/services/order.service';

vi.mock('@/server/storage/minio', () => ({
  presignPut: vi.fn(async () => 'https://mock.local/put'),
  presignGet: vi.fn(async () => 'https://mock.local/get'),
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  S3_BUCKET: 'campus-market',
}));

const TEST_URL = process.env.DATABASE_URL_TEST!;
const BUYER = 'stu_test';
const CREATOR = 'creator_test';

beforeAll(async () => {
  execSync('pnpm exec prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'ignore',
  });
  await flushDb(prisma);
  await seedTestData(prisma);
  // 付费作品
  await prisma.work.create({
    data: {
      id: 'paid_work',
      authorId: CREATOR,
      title: '付费精品',
      description: '付费作品描述',
      course: '测试课程',
      fileType: 'PDF',
      fileKey: 'works/paid.pdf',
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
  await prisma.$disconnect();
});

describe('交易服务（阶段 4）', () => {
  it('下单(mock)：立即 PAID + 生成 Download + 收益流水 + 钱包 pending', async () => {
    const walletBefore = await prisma.wallet.findUniqueOrThrow({
      where: {
        creatorId: (await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: CREATOR } }))
          .id,
      },
    });

    const { orderId, pay, access } = await orderService.createOrder(BUYER, 'paid_work', 'MOCK');
    expect(pay.provider).toBe('mock');
    expect(access).toBeUndefined();

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.payStatus).toBe('PAID');
    expect(order.creatorAmount.toFixed(2)).toBe('8.91');
    expect(order.platformFee.toFixed(2)).toBe('0.99');

    const dl = await prisma.download.findUnique({
      where: { workId_userId: { workId: 'paid_work', userId: BUYER } },
    });
    expect(dl).toBeTruthy();

    const income = await prisma.creatorIncome.findUnique({ where: { orderId } });
    expect(income?.status).toBe('PENDING');
    expect(income?.settleAt).toBeTruthy();

    const walletAfter = await prisma.wallet.findUniqueOrThrow({
      where: { creatorId: walletBefore.creatorId },
    });
    expect(walletAfter.pending.toFixed(2)).toBe(
      (walletBefore.pending.toNumber() + 8.91).toFixed(2),
    );
  });

  it('重复下单：已购 → access=true', async () => {
    const result = await orderService.createOrder(BUYER, 'paid_work', 'MOCK');
    expect(result.access).toBe(true);
  });

  it('回调幂等：重复 markPaid 只生效一次', async () => {
    const order = await prisma.order.findFirstOrThrow({
      where: { workId: 'paid_work', buyerId: BUYER },
    });
    const incomeCount = await prisma.creatorIncome.count();
    const r1 = await orderService.markPaid(order.id, 'tx-dup', 'idem-dup');
    expect(r1.already).toBe(true);
    expect(await prisma.creatorIncome.count()).toBe(incomeCount); // 不重复建收益
  });

  it('下载：已购作品 → 返回 URL；未购付费作品 → PAYMENT_REQUIRED', async () => {
    const dl = await orderService.download(BUYER, 'paid_work');
    expect(dl.url).toBe('https://mock.local/get');

    // 建另一个未购付费作品
    await prisma.work.create({
      data: {
        id: 'paid_work_2',
        authorId: CREATOR,
        title: '未购作品',
        description: 'x',
        course: 'x',
        fileType: 'PDF',
        fileKey: 'x',
        fileSize: 100,
        isFree: false,
        price: 5,
        status: 'PUBLISHED',
        copyrightAccepted: true,
        previewToc: [],
        publishedAt: new Date(),
      },
    });
    await expect(orderService.download(BUYER, 'paid_work_2')).rejects.toMatchObject({
      code: 'PAYMENT_REQUIRED',
    });
  });

  it('免费作品直接下载 + 首次计数', async () => {
    const before = await prisma.work.findUniqueOrThrow({ where: { id: 'work_test' } });
    await orderService.download(BUYER, 'work_test');
    await orderService.download(BUYER, 'work_test'); // 第二次不重复计数
    const after = await prisma.work.findUniqueOrThrow({ where: { id: 'work_test' } });
    expect(after.downloads).toBe(before.downloads + 1);
  });

  it('退款：已下载 → 自助退款 REFUND_NOT_ALLOWED', async () => {
    const order = await prisma.order.findFirstOrThrow({
      where: { workId: 'paid_work', buyerId: BUYER, payStatus: 'PAID' },
    });
    await expect(
      orderService.refund(order.id, BUYER, { reason: '不想要了' }),
    ).rejects.toMatchObject({ code: 'REFUND_NOT_ALLOWED' });
  });

  it('退款：平台退款（管理员）→ REFUNDED + 撤销下载权 + 冲减收益', async () => {
    const order = await prisma.order.findFirstOrThrow({
      where: { workId: 'paid_work', buyerId: BUYER, payStatus: 'PAID' },
    });
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: {
        creatorId: (await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: CREATOR } }))
          .id,
      },
    });
    const pendingBefore = Number(wallet.pending);

    await orderService.refund(order.id, 'admin', { reason: '侵权下架', isAdmin: true });

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.payStatus).toBe('REFUNDED');
    const dl = await prisma.download.findUnique({
      where: { workId_userId: { workId: 'paid_work', userId: BUYER } },
    });
    expect(dl).toBeNull();
    const walletAfter = await prisma.wallet.findUniqueOrThrow({
      where: {
        creatorId: (await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: CREATOR } }))
          .id,
      },
    });
    expect(Number(walletAfter.pending)).toBeLessThan(pendingBefore);
  });

  it('退款：未支付订单 → ORDER_CLOSED', async () => {
    const order = await prisma.order.create({
      data: {
        id: 'o_unpaid',
        workId: 'paid_work',
        buyerId: BUYER,
        amount: 9.9,
        platformFee: 0.99,
        creatorAmount: 8.91,
        payMethod: 'MOCK',
        payStatus: 'PENDING',
      },
    });
    await expect(orderService.refund(order.id, BUYER, {})).rejects.toMatchObject({
      code: 'ORDER_CLOSED',
    });
  });
});
