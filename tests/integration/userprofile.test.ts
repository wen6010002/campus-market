// V3-5 测试：用户主页 API（detail 三态 / follows / PATCH profile / avatar 校验）。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { prisma } from '@/server/db';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';
import { socialService } from '@/server/services/social.service';
import { meService } from '@/server/services/me.service';

vi.mock('@/server/storage/minio', () => ({
  presignPut: vi.fn(async () => 'https://mock.local/put'),
  presignGet: vi.fn(async () => 'https://mock.local/get'),
  presignGetInline: vi.fn(async () => 'https://mock.local/inline'),
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  objectExists: vi.fn(async (key: string) => key.startsWith('avatars/')),
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

describe('个人主页（V3-5）', () => {
  it('userDetail：匿名无 myFollow/isSelf；本人 isSelf；他人 myFollow 随关注变化', async () => {
    const anon = await socialService.userDetail('creator_test');
    expect(anon.username).toBe('测试创作者');
    expect(anon.myFollow).toBe(false);
    expect(anon.isSelf).toBe(false);

    const self = await socialService.userDetail('stu_test', 'stu_test');
    expect(self.isSelf).toBe(true);

    await socialService.follow('stu_test', 'creator_test');
    const other = await socialService.userDetail('creator_test', 'stu_test');
    expect(other.myFollow).toBe(true);
    expect(other.fans).toBeGreaterThan(0);
  });

  it('userFollows：following/followers 各自正确，含 myFollow 标记', async () => {
    const following = await socialService.userFollows('stu_test', 'following', 1, 'stu_test');
    expect(following.length).toBe(1);
    expect(following[0].id).toBe('creator_test');
    expect(following[0].myFollow).toBe(true);

    const followers = await socialService.userFollows('creator_test', 'followers', 1);
    expect(followers.some((f: any) => f.id === 'stu_test')).toBe(true);
  });

  it('userRatings：返回评价带 work 摘要', async () => {
    const rs = await socialService.userRatings('stu_test');
    expect(Array.isArray(rs)).toBe(true);
    for (const r of rs) expect(r.work).toHaveProperty('title');
  });

  it('PATCH profile：改名成功；重名 USERNAME_TAKEN；bio 超长被 zod 层拦截（服务层直调验证写入）', async () => {
    const updated = await meService.updateProfile('stu_test', {
      username: '测试学生新名',
      bio: '新简介',
      college: '计算机与软件学院',
    });
    expect(updated.username).toBe('测试学生新名');

    await expect(
      meService.updateProfile('stu_test', { username: '测试创作者' }),
    ).rejects.toMatchObject({ code: 'USERNAME_TAKEN' });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: 'stu_test' } });
    expect(user.bio).toBe('新简介');
  });

  it('setAvatar：对象不存在 → BAD_FILE；存在 → 落 avatarKey', async () => {
    await expect(meService.setAvatar('stu_test', 'works/fake/x.pdf')).rejects.toMatchObject({
      code: 'BAD_FILE',
    });
    await meService.setAvatar('stu_test', 'avatars/stu_test/a.jpg');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: 'stu_test' } });
    expect(user.avatarKey).toBe('avatars/stu_test/a.jpg');
  });
});
