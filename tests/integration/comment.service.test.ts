// V2-5 测试：评论 CRUD/sanitize/权限 + 成就幂等 + 文件指纹去重。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { prisma } from '@/server/db';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';
import { commentService } from '@/server/services/comment.service';
import { achievementService } from '@/server/services/achievement.service';
import { workService } from '@/server/services/work.service';
import type { WorkInput } from '@/lib/zod/work';

const TEST_URL = process.env.DATABASE_URL_TEST!;
const CREATOR_ID = 'creator_test';
const STUDENT_ID = 'stu_test';
const WORK_ID = 'work_test';

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

const validInput: WorkInput = {
  title: '原创测试作品',
  description: '描述',
  course: '课程',
  fileType: 'PDF',
  fileKey: 'works/test/orig.pdf',
  fileSize: 1024,
  category: 'COURSE',
  isFree: true,
  tags: [],
  previewToc: [],
  isOriginal: true,
  copyrightAccepted: true,
};

describe('功能补全（V2-5）', () => {
  it('评论：创建后 sanitize，非作者删除 403', async () => {
    const c = await commentService.create(
      STUDENT_ID,
      WORK_ID,
      '<script>alert(1)</script>很好<b>内容</b>',
    );
    expect(c.content).toBe('很好<b>内容</b>');

    const list = await commentService.list(WORK_ID, 1, 10);
    expect(list.data.some((x) => x.id === c.id)).toBe(true);

    await expect(commentService.remove(c.id, 'other_user', false)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await commentService.remove(c.id, STUDENT_ID, false); // 本人可删
  });

  it('成就：grant 幂等（重复授予只一次）', async () => {
    const r1 = await achievementService.grant(CREATOR_ID, 'FIRST_INCOME');
    const r2 = await achievementService.grant(CREATOR_ID, 'FIRST_INCOME');
    expect(r1).toBe(true);
    expect(r2).toBe(false); // 第二次不重复

    const list = await achievementService.listForUser(CREATOR_ID);
    const income = list.find((a) => a.key === 'FIRST_INCOME');
    expect(income?.got).toBe(true);
  });

  it('文件指纹去重：重复 fileSha 拒绝上架', async () => {
    const sha = 'sha-' + Math.random().toString(36).slice(2);
    await workService.create(CREATOR_ID, { ...validInput, fileSha: sha, title: '第一个' });
    await expect(
      workService.create(CREATOR_ID, { ...validInput, fileSha: sha, title: '第二个重复' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('原创字段：默认 true，可显式标记非原创', async () => {
    const w = await workService.create(CREATOR_ID, {
      ...validInput,
      title: '转载作品',
      isOriginal: false,
    });
    const row = await prisma.work.findUniqueOrThrow({ where: { id: w.id } });
    expect(row.isOriginal).toBe(false);
  });
});
