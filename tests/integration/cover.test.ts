// V3-3 测试：presign kind 规则 + 封面 302 代理路由。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { prisma } from '@/server/db';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';
import { uploadService } from '@/server/services/upload.service';

vi.mock('@/server/storage/minio', () => ({
  presignPut: vi.fn(async () => 'https://mock.local/put'),
  presignGet: vi.fn(async () => 'https://mock.local/get'),
  presignGetInline: vi.fn(async () => 'https://mock.local/inline'),
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  S3_BUCKET: 'campus-market',
}));

const TEST_URL = process.env.DATABASE_URL_TEST!;

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

describe('封面系统（V3-3）：presign kind 规则', () => {
  it('kind=cover 只允许 IMAGE，拒绝 PDF', async () => {
    await expect(
      uploadService.presign({ kind: 'cover', fileType: 'PDF', fileSize: 1024 }, 'stu_test'),
    ).rejects.toMatchObject({ code: 'FILE_TYPE_DENIED' });
  });

  it('kind=cover 拒绝超过 5MB', async () => {
    await expect(
      uploadService.presign(
        { kind: 'cover', fileType: 'IMAGE', fileSize: 6 * 1024 * 1024 },
        'stu_test',
      ),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('kind=cover 合法请求返回 covers/ 前缀 key', async () => {
    const r = await uploadService.presign(
      { kind: 'cover', fileType: 'IMAGE', fileSize: 1024 },
      'stu_test',
    );
    expect(r.fileKey.startsWith('covers/stu_test/')).toBe(true);
  });

  it('kind=preview 只允许 PDF，返回 previews/ 前缀', async () => {
    await expect(
      uploadService.presign({ kind: 'preview', fileType: 'IMAGE', fileSize: 1024 }, 'stu_test'),
    ).rejects.toMatchObject({ code: 'FILE_TYPE_DENIED' });
    const r = await uploadService.presign(
      { kind: 'preview', fileType: 'PDF', fileSize: 1024 },
      'stu_test',
    );
    expect(r.fileKey.startsWith('previews/stu_test/')).toBe(true);
  });

  it('不传 kind 默认 work 前缀（向后兼容）', async () => {
    const r = await uploadService.presign({ fileType: 'PDF', fileSize: 1024 }, 'stu_test');
    expect(r.fileKey.startsWith('works/stu_test/')).toBe(true);
  });
});
