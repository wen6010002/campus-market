// V3-2 测试：开放发布——学生 ensureCreatorProfile 自动建未认证 CreatorProfile + 角色升级 + 幂等。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { prisma } from '@/server/db';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';
import { ensureCreatorProfile } from '@/server/auth/session';

vi.mock('@/server/storage/minio', () => ({
  presignPut: vi.fn(async () => 'https://mock.local/put'),
  presignGet: vi.fn(async () => 'https://mock.local/get'),
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

describe('开放发布（V3-2）：ensureCreatorProfile', () => {
  it('学生首次发布：自动创建未认证 CreatorProfile + role 升级 CREATOR', async () => {
    const before = await prisma.user.findUnique({
      where: { id: 'stu_test' },
      include: { creator: true },
    });
    expect(before?.role).toBe('STUDENT');
    expect(before?.creator).toBeNull();

    const cpId = await ensureCreatorProfile('stu_test');
    expect(cpId).toBeTruthy();

    const after = await prisma.user.findUnique({
      where: { id: 'stu_test' },
      include: { creator: true },
    });
    expect(after?.role).toBe('CREATOR');
    expect(after?.creator).not.toBeNull();
    expect(after?.creator?.verified).toBe(false); // 未认证徽章，不阻塞发布
    expect(after?.creator?.id).toBe(cpId);
  });

  it('幂等：再次调用不重复创建 CreatorProfile', async () => {
    const id1 = await ensureCreatorProfile('stu_test');
    const id2 = await ensureCreatorProfile('stu_test');
    expect(id1).toBe(id2);
    const count = await prisma.creatorProfile.count({ where: { userId: 'stu_test' } });
    expect(count).toBe(1);
  });
});
