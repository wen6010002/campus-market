// V6 集成测试：码支付 GET 回调 —— 验签、金额校验、结算、幂等、负路径。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { prisma } from '@/server/db';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';

vi.mock('@/server/storage/minio', () => ({
  presignPut: vi.fn(async () => 'https://mock.local/put'),
  presignGet: vi.fn(async () => 'https://mock.local/get'),
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  S3_BUCKET: 'campus-market',
}));

const TEST_URL = process.env.DATABASE_URL_TEST!;
const BUYER = 'stu_test';
const CREATOR = 'creator_test';
const PID = '1148';
const KEY = 'integration-pay-key';

// 动态 import：路由持有 epayProvider 单例（env 惰性读取，stubEnv 在调用前生效即可）
const { GET } = await import('@/app/api/v1/webhooks/pay/epay/route');
const { buildEpayMessage, md5Sign } = await import('@/server/payment/epay');

function notifyUrl(params: Record<string, string>): string {
  const sign = md5Sign(buildEpayMessage(params), KEY);
  const q = new URLSearchParams({ ...params, sign, sign_type: 'MD5' });
  return `https://kedahub.cn/api/v1/webhooks/pay/epay?${q.toString()}`;
}

function baseNotify(orderId: string, money: string, extra: Record<string, string> = {}) {
  return {
    pid: PID,
    trade_no: `EPAY${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    out_trade_no: orderId,
    type: 'alipay',
    name: '付费精品',
    money,
    trade_status: 'TRADE_SUCCESS',
    ...extra,
  };
}

async function createPendingOrder(amount: string) {
  return prisma.order.create({
    data: {
      workId: 'paid_work_epay',
      buyerId: BUYER,
      amount,
      platformFee: (Number(amount) * 0.1).toFixed(2),
      creatorAmount: (Number(amount) * 0.9).toFixed(2),
      payMethod: 'ALIPAY',
      payStatus: 'PENDING',
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
  });
}

beforeAll(async () => {
  execSync('pnpm exec prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'ignore',
  });
  await flushDb(prisma);
  await seedTestData(prisma);
  vi.stubEnv('EPAY_PID', PID);
  vi.stubEnv('EPAY_KEY', KEY);
  await prisma.work.create({
    data: {
      id: 'paid_work_epay',
      authorId: CREATOR,
      title: '付费精品',
      description: 'epay 测试作品',
      course: '测试课程',
      fileType: 'PDF',
      fileKey: 'works/epay.pdf',
      fileSize: 2048,
      isFree: false,
      price: 1.0,
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

describe('码支付回调（V6）', () => {
  it('合法签名 + 金额相符 → ack 纯文本 success + 订单 PAID + 下载权 + 收益入账', async () => {
    const order = await createPendingOrder('1.00');
    const res = await GET(new Request(notifyUrl(baseNotify(order.id, '1.00'))));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('success');

    const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid.payStatus).toBe('PAID');
    expect(paid.transactionId).toBeTruthy();
    expect(
      await prisma.download.findUnique({
        where: { workId_userId: { workId: 'paid_work_epay', userId: BUYER } },
      }),
    ).toBeTruthy();
    expect(await prisma.creatorIncome.findUnique({ where: { orderId: order.id } })).toBeTruthy();
  });

  it('篡改签名 → 500 不结算', async () => {
    const order = await createPendingOrder('1.00');
    const params = baseNotify(order.id, '1.00');
    const bad = new URLSearchParams({ ...params, sign: 'deadbeef', sign_type: 'MD5' });
    const res = await GET(new Request(`https://kedahub.cn/api/v1/webhooks/pay/epay?${bad}`));
    expect(res.status).toBe(500);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).payStatus).toBe(
      'PENDING',
    );
  });

  it('签名合法但金额不符（重签低价单）→ 拒绝且不 ack', async () => {
    const order = await createPendingOrder('9.90');
    const res = await GET(new Request(notifyUrl(baseNotify(order.id, '0.01')))); // 0.01 冒充 9.90
    expect(res.status).toBe(500);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).payStatus).toBe(
      'PENDING',
    );
  });

  it('trade_status 非 TRADE_SUCCESS → ack 但不结算', async () => {
    const order = await createPendingOrder('1.00');
    const res = await GET(
      new Request(notifyUrl(baseNotify(order.id, '1.00', { trade_status: 'WAIT_BUYER_PAY' }))),
    );
    expect(res.status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).payStatus).toBe(
      'PENDING',
    );
  });

  it('CLOSED 订单收到合法回调 → 重开结算（超时关单后才付款，钱不能白收）', async () => {
    const order = await createPendingOrder('1.00');
    await prisma.order.update({ where: { id: order.id }, data: { payStatus: 'CLOSED' } });
    const res = await GET(new Request(notifyUrl(baseNotify(order.id, '1.00'))));
    expect(res.status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).payStatus).toBe(
      'PAID',
    );
  });

  it('重复回调（同流水）→ 幂等 success，不重复结算', async () => {
    const order = await createPendingOrder('1.00');
    const params = baseNotify(order.id, '1.00');
    const url = notifyUrl(params);
    await GET(new Request(url));
    const res2 = await GET(new Request(url)); // 同 trade_no 重放
    expect(res2.status).toBe(200);
    expect(await prisma.creatorIncome.count({ where: { orderId: order.id } })).toBe(1);
  });
});
