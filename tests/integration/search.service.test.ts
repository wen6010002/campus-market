// 阶段 8 测试：搜索召回 / 排行榜 / 质量升降级。
import { execSync } from 'node:child_process';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { prisma } from '@/server/db';
import { flushDb } from '../helpers/flush';
import { seedTestData } from '../../prisma/seed.test';
import { searchService } from '@/server/services/search.service';
import { rankService } from '@/server/services/rank.service';
import { qualityService } from '@/server/services/quality.service';

const TEST_URL = process.env.DATABASE_URL_TEST!;

beforeAll(async () => {
  execSync('pnpm exec prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'ignore',
  });
  await flushDb(prisma);
  await seedTestData(prisma);
  await prisma.tag.upsert({ where: { name: '数据库' }, update: {}, create: { name: '数据库' } });
  await prisma.workTag.upsert({
    where: {
      workId_tagId: {
        workId: 'work_test',
        tagId: (await prisma.tag.findUniqueOrThrow({ where: { name: '数据库' } })).id,
      },
    },
    update: {},
    create: {
      workId: 'work_test',
      tagId: (await prisma.tag.findUniqueOrThrow({ where: { name: '数据库' } })).id,
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('搜索/排行/质量（阶段 8）', () => {
  it('搜索：按标题召回作品', async () => {
    const r = await searchService.search('测试作品');
    expect(r.works.some((w) => w.id === 'work_test')).toBe(true);
  });

  it('搜索：按标签召回', async () => {
    const r = await searchService.search('数据库');
    expect(r.works.some((w) => w.id === 'work_test')).toBe(true);
  });

  it('搜索：按创作者名召回', async () => {
    const r = await searchService.search('测试创作者');
    expect(r.creators.some((c) => c.id === 'creator_test')).toBe(true);
  });

  it('排行榜：fav 返回作品', async () => {
    const favs = await rankService.ranks('fav');
    expect(Array.isArray(favs)).toBe(true);
  });

  it('排行榜：help 返回创作者（按 helped 降序）', async () => {
    const help = await rankService.ranks('help');
    expect(help.length).toBeGreaterThan(0);
    expect((help[0] as { creator?: unknown }).creator).toBeTruthy();
  });

  it('质量：达标作品 NORMAL → HIGH，跌破 → NORMAL', async () => {
    await prisma.work.create({
      data: {
        id: 'quality_work',
        authorId: 'creator_test',
        title: '高质量作品',
        description: 'x',
        course: 'x',
        fileType: 'PDF',
        fileKey: 'x',
        fileSize: 100,
        isFree: true,
        status: 'PUBLISHED',
        quality: 'NORMAL',
        copyrightAccepted: true,
        rating: 4.9,
        ratingCount: 30,
        downloads: 600,
        previewToc: [],
        publishedAt: new Date(),
      },
    });
    const r1 = await qualityService.refreshQuality();
    expect(r1.upgraded).toBeGreaterThan(0);
    expect((await prisma.work.findUniqueOrThrow({ where: { id: 'quality_work' } })).quality).toBe(
      'HIGH',
    );

    await prisma.work.update({ where: { id: 'quality_work' }, data: { downloads: 10 } });
    await qualityService.refreshQuality();
    expect((await prisma.work.findUniqueOrThrow({ where: { id: 'quality_work' } })).quality).toBe(
      'NORMAL',
    );
  });
});
