// 阶段 3 测试：作品 CRUD 权限 / 状态机迁移 / 浏览计数。
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
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  S3_BUCKET: 'campus-market',
}));

const TEST_URL = process.env.DATABASE_URL_TEST!;
const CREATOR_ID = 'creator_test';
const STUDENT_ID = 'stu_test';

const validInput: WorkInput = {
  title: '测试新作品',
  description: '描述内容',
  course: '测试课程',
  fileType: 'PDF',
  fileKey: 'works/test/new.pdf',
  fileSize: 1024,
  category: 'COURSE',
  isFree: true,
  tags: ['测试'],
  previewToc: ['第一章'],
  isOriginal: true,
  copyrightAccepted: true,
};

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

describe('作品服务（阶段 3）', () => {
  it('创建：未勾选版权 → COPYRIGHT_REQUIRED', async () => {
    await expect(
      workService.create(CREATOR_ID, { ...validInput, copyrightAccepted: false }),
    ).rejects.toMatchObject({ code: 'COPYRIGHT_REQUIRED' });
  });

  it('创建：创作者创建 → DRAFT', async () => {
    const w = await workService.create(CREATOR_ID, validInput);
    expect(w.status).toBe('DRAFT');
    expect(w.author.id).toBe(CREATOR_ID);
  });

  it('更新：非作者 → FORBIDDEN', async () => {
    await expect(workService.update('work_test', STUDENT_ID, validInput)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('发布：DRAFT → PENDING', async () => {
    const w = await workService.create(CREATOR_ID, { ...validInput, title: '待发布作品' });
    const published = await workService.publish(w.id, CREATOR_ID);
    expect(published.status).toBe('PENDING');
  });

  it('审核状态机：PENDING → APPROVE → PUBLISHED', async () => {
    const w = await workService.create(CREATOR_ID, { ...validInput, title: '待审核作品' });
    await workService.publish(w.id, CREATOR_ID);
    const approved = await workService.adminAudit(w.id, 'APPROVE', undefined, CREATOR_ID);
    expect(approved.status).toBe('PUBLISHED');
    const log = await prisma.auditLog.findFirst({ where: { workId: w.id } });
    expect(log?.action).toBe('APPROVE');
  });

  it('审核状态机：REJECT → REJECTED', async () => {
    const w = await workService.create(CREATOR_ID, { ...validInput, title: '被驳回作品' });
    await workService.publish(w.id, CREATOR_ID);
    const rejected = await workService.adminAudit(w.id, 'REJECT', '内容不符', CREATOR_ID);
    expect(rejected.status).toBe('REJECTED');
  });

  it('列表：仅返回 PUBLISHED', async () => {
    const result = await workService.list({ page: 1, pageSize: 20, sort: 'new' } as any);
    expect(result.data.every((w: any) => w.status === 'PUBLISHED')).toBe(true);
  });

  it('观看计数（V3-4）：预览打开才计数，同人 24h 去重', async () => {
    await redis.del([
      'view:work_test',
      'viewd:u:stu_test:work_test',
      'viewd:u:creator_test:work_test',
      'viewd:i:127.0.0.1:work_test',
    ]);
    // 详情读取不再计数
    await workService.get('work_test');
    expect(await redis.get('view:work_test')).toBeNull();
    // 预览打开计数一次
    const r1 = await workService.getPreview('work_test', 'stu_test', '127.0.0.1');
    expect(r1.mode).toBe('full'); // work_test 为免费作品
    expect(await redis.get('view:work_test')).toBe('1');
    // 同一用户重复打开不重复计数
    await workService.getPreview('work_test', 'stu_test', '127.0.0.1');
    expect(await redis.get('view:work_test')).toBe('1');
    // 不同用户各计一次
    await workService.getPreview('work_test', 'creator_test', '127.0.0.1');
    expect(await redis.get('view:work_test')).toBe('2');
    await redis.del('view:work_test');
  });

  // ===== V3-2 分类体系 =====
  it('创建：带 category 落库且列表返回', async () => {
    const w = await workService.create(CREATOR_ID, {
      ...validInput,
      title: '分类测试作品',
      category: 'CAMPUS',
    });
    expect(w.category).toBe('CAMPUS');
  });

  it('列表：category 过滤只返回该大类', async () => {
    const w = await workService.create(CREATOR_ID, {
      ...validInput,
      title: '待发布分类作品',
      category: 'CAMPUS',
    });
    await workService.publish(w.id, CREATOR_ID);
    await workService.adminAudit(w.id, 'APPROVE', undefined, CREATOR_ID);
    const result = await workService.list({
      page: 1,
      pageSize: 20,
      sort: 'new',
      category: 'CAMPUS',
    } as any);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((x: any) => x.category === 'CAMPUS')).toBe(true);
  });

  it('课程聚合：courses 返回 {course,count} 且可按大类过滤', async () => {
    const all = await workService.courses();
    expect(Array.isArray(all)).toBe(true);
    expect(all[0]).toHaveProperty('course');
    expect(all[0]).toHaveProperty('count');
    const campus = await workService.courses('CAMPUS');
    expect(campus.every((c: any) => c.count > 0)).toBe(true);
  });
});
