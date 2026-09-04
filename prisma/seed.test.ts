// 测试种子：最小确定性 fixture。供 tests/integration 与 `pnpm db:seed:test` 使用。
import { PrismaClient, Role } from '@prisma/client';
import { ACHIEVEMENT_DICT } from '../src/lib/achievements';

export async function seedTestData(prisma: PrismaClient) {
  // 成就 + 标签（评分/作品标签需 FK）
  for (const a of ACHIEVEMENT_DICT) {
    await prisma.achievement.upsert({
      where: { key: a.key },
      update: {
        rarity: a.rarity,
        symbol: a.symbol,
        description: a.description,
        title: a.title,
        emoji: a.emoji,
      },
      create: {
        key: a.key,
        emoji: a.emoji,
        title: a.title,
        rarity: a.rarity,
        symbol: a.symbol,
        description: a.description,
      },
    });
  }
  for (const n of ['内容详细', '通俗易懂']) {
    await prisma.ratingTag.upsert({
      where: { name: n },
      update: {},
      create: { name: n, isPositive: true },
    });
  }

  // 用户：学生 stu + 创作者 creator
  const stu = await prisma.user.upsert({
    where: { id: 'stu_test' },
    update: {},
    create: {
      id: 'stu_test',
      email: 'stu@szu.edu.cn',
      username: '测试学生',
      passwordHash: 'hash',
      passwordPepper: 'seed',
      role: Role.STUDENT,
      student: {
        create: {
          eduEmail: 'stu@szu.edu.cn',
          school: '深圳大学',
          college: '计软',
          major: '计算机',
          grade: '大二',
          verifyStatus: 'VERIFIED',
        },
      },
    },
  });
  const creator = await prisma.user.upsert({
    where: { id: 'creator_test' },
    update: {},
    create: {
      id: 'creator_test',
      email: 'creator@szu.edu.cn',
      username: '测试创作者',
      passwordHash: 'hash',
      passwordPepper: 'seed',
      role: Role.CREATOR,
      student: {
        create: {
          eduEmail: 'creator@szu.edu.cn',
          school: '深圳大学',
          college: '计软',
          major: '软件',
          grade: '大三',
          verifyStatus: 'VERIFIED',
        },
      },
      creator: {
        create: {
          bio: '测试',
          direction: '测试方向',
          verified: true,
          wallet: { create: { balance: 0, pending: 0, withdrawn: 0 } },
        },
      },
    },
  });

  // 作品
  const work = await prisma.work.upsert({
    where: { id: 'work_test' },
    update: {},
    create: {
      id: 'work_test',
      authorId: creator.id,
      title: '测试作品',
      description: '测试描述',
      course: '测试课程',
      fileType: 'PDF',
      fileKey: 'works/test/work_test.pdf',
      fileSize: 1024,
      previewToc: ['第一章'],
      isFree: true,
      status: 'PUBLISHED',
      quality: 'NORMAL',
      copyrightAccepted: true,
      rating: 0,
      ratingCount: 0,
      ratingDist: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 },
      publishedAt: new Date(),
    },
  });

  return { stu, creator, work };
}

// CLI 入口：直接跑 `pnpm db:seed:test`
import { fileURLToPath } from 'node:url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const prisma = new PrismaClient();
  seedTestData(prisma)
    .then(() => console.log('✅ 测试种子完成'))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
