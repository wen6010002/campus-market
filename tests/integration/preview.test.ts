// V3-4 测试：预览权限矩阵（免费全量 / 付费试读 / 已购全量 / 非 PDF none / 未发布 404）。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { prisma } from '@/server/db';
import { redis } from '@/server/lib/redis';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';
import { workService } from '@/server/services/work.service';
import type { WorkInput } from '@/lib/zod/work';

vi.mock('@/server/storage/minio', () => ({
  presignPut: vi.fn(async () => 'https://mock.local/put'),
  presignGet: vi.fn(async () => 'https://mock.local/get'),
  presignGetInline: vi.fn(async (key: string) => `https://mock.local/inline/${key}`),
  getObjectText: vi.fn(async (key: string) => `# md 全文 ${key}`),
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  S3_BUCKET: 'campus-market',
}));

const TEST_URL = process.env.DATABASE_URL_TEST!;
const CREATOR_ID = 'creator_test';

const input: WorkInput = {
  title: '预览测试',
  description: '描述',
  course: '测试课程',
  fileType: 'PDF',
  fileKey: 'works/test/preview.pdf',
  fileSize: 1024,
  category: 'COURSE',
  isFree: true,
  tags: [],
  previewToc: [],
  isOriginal: true,
  copyrightAccepted: true,
};

async function publish(id: string) {
  await workService.publish(id, CREATOR_ID);
  await workService.adminAudit(id, 'APPROVE', undefined, CREATOR_ID);
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

describe('在线预览（V3-4）：getPreview 权限矩阵', () => {
  it('免费作品：匿名 → full，URL 指向原文件', async () => {
    const w = await workService.create(CREATOR_ID, input);
    await publish(w.id);
    const r = await workService.getPreview(w.id, undefined, '1.2.3.4');
    expect(r.mode).toBe('full');
    expect(r.url).toContain('works/test/preview.pdf');
  });

  it('付费未购且有试读副本：匿名 → sample，URL 指向 previewKey', async () => {
    const w = await prisma.work.create({
      data: {
        authorId: CREATOR_ID,
        title: '付费带试读',
        description: 'x',
        course: 'c',
        fileType: 'PDF',
        fileKey: 'works/test/paid.pdf',
        previewKey: 'previews/test/sample.pdf',
        fileSize: 1024,
        isFree: false,
        price: 9.9,
        status: 'PUBLISHED',
        previewToc: [],
        copyrightAccepted: true,
      },
    });
    const r = await workService.getPreview(w.id, undefined, '1.2.3.4');
    expect(r.mode).toBe('sample');
    expect(r.url).toContain('previews/test/sample.pdf');
  });

  it('付费未购且无副本 → none，不计观看', async () => {
    const w = await prisma.work.create({
      data: {
        authorId: CREATOR_ID,
        title: '付费无试读',
        description: 'x',
        course: 'c',
        fileType: 'PDF',
        fileKey: 'works/test/paid2.pdf',
        fileSize: 1024,
        isFree: false,
        price: 9.9,
        status: 'PUBLISHED',
        previewToc: [],
        copyrightAccepted: true,
      },
    });
    await redis.del(`view:${w.id}`);
    const r = await workService.getPreview(w.id, undefined, '1.2.3.4');
    expect(r.mode).toBe('none');
    expect(r.url).toBeNull();
    expect(await redis.get(`view:${w.id}`)).toBeNull();
  });

  it('已购买 → full（原文件）', async () => {
    const w = await prisma.work.create({
      data: {
        authorId: CREATOR_ID,
        title: '付费已购',
        description: 'x',
        course: 'c',
        fileType: 'PDF',
        fileKey: 'works/test/paid3.pdf',
        previewKey: 'previews/test/sample3.pdf',
        fileSize: 1024,
        isFree: false,
        price: 9.9,
        status: 'PUBLISHED',
        previewToc: [],
        copyrightAccepted: true,
      },
    });
    await prisma.order.create({
      data: {
        workId: w.id,
        buyerId: 'stu_test',
        amount: 9.9,
        platformFee: 0.99,
        creatorAmount: 8.91,
        payMethod: 'MOCK',
        payStatus: 'PAID',
        paidAt: new Date(),
      },
    });
    const r = await workService.getPreview(w.id, 'stu_test', '1.2.3.4');
    expect(r.mode).toBe('full');
    expect(r.url).toContain('works/test/paid3.pdf');
  });

  it('非 PDF/MD → none', async () => {
    const w = await prisma.work.create({
      data: {
        authorId: CREATOR_ID,
        title: 'docx 作品',
        description: 'x',
        course: 'c',
        fileType: 'DOCX',
        fileKey: 'works/test/paid4.docx',
        fileSize: 1024,
        isFree: true,
        status: 'PUBLISHED',
        previewToc: [],
        copyrightAccepted: true,
      },
    });
    const r = await workService.getPreview(w.id, undefined, '1.2.3.4');
    expect(r.mode).toBe('none');
  });

  it('免费 MD → full，服务端直回文本（无 URL）', async () => {
    const w = await prisma.work.create({
      data: {
        authorId: CREATOR_ID,
        title: 'md 免费',
        description: 'x',
        course: 'c',
        fileType: 'MD',
        fileKey: 'works/test/free.md',
        fileSize: 2048,
        isFree: true,
        status: 'PUBLISHED',
        previewToc: [],
        copyrightAccepted: true,
      },
    });
    const r = await workService.getPreview(w.id, undefined, '1.2.3.4');
    expect(r.mode).toBe('full');
    expect(r.content).toContain('works/test/free.md');
    expect(r.url).toBeNull();
  });

  it('付费 MD 未购有试读副本 → sample，文本指向副本', async () => {
    const w = await prisma.work.create({
      data: {
        authorId: CREATOR_ID,
        title: 'md 付费带试读',
        description: 'x',
        course: 'c',
        fileType: 'MD',
        fileKey: 'works/test/md-paid.md',
        previewKey: 'previews/test/md-sample.md',
        fileSize: 2048,
        isFree: false,
        price: 4.9,
        status: 'PUBLISHED',
        previewToc: [],
        copyrightAccepted: true,
      },
    });
    const r = await workService.getPreview(w.id, undefined, '1.2.3.4');
    expect(r.mode).toBe('sample');
    expect(r.content).toContain('previews/test/md-sample.md');
  });

  it('付费 MD 未购无副本 → none', async () => {
    const w = await prisma.work.create({
      data: {
        authorId: CREATOR_ID,
        title: 'md 付费无试读',
        description: 'x',
        course: 'c',
        fileType: 'MD',
        fileKey: 'works/test/md-paid2.md',
        fileSize: 2048,
        isFree: false,
        price: 4.9,
        status: 'PUBLISHED',
        previewToc: [],
        copyrightAccepted: true,
      },
    });
    const r = await workService.getPreview(w.id, undefined, '1.2.3.4');
    expect(r.mode).toBe('none');
    expect(r.content).toBeNull();
  });

  it('未发布作品 → NOT_FOUND（作者除外）', async () => {
    const w = await workService.create(CREATOR_ID, { ...input, title: '草稿不可预览' });
    await expect(workService.getPreview(w.id, undefined, '1.2.3.4')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const own = await workService.getPreview(w.id, CREATOR_ID, '1.2.3.4');
    expect(own.mode).toBe('full'); // 作者可看自己草稿
  });
});
