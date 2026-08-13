import { prisma } from '../db';

// 质量等级（§8.3）：HIGH 阈值 rating>=4.8 AND ratingCount>=20 AND downloads>=500；
// 跌破阈值回 NORMAL（SELECTED 仅管理员手工标记，不自动升降级）。
export const qualityService = {
  async refreshQuality() {
    const [upgrade, downgrade] = await Promise.all([
      prisma.work.updateMany({
        where: {
          status: 'PUBLISHED',
          quality: 'NORMAL',
          rating: { gte: 4.8 },
          ratingCount: { gte: 20 },
          downloads: { gte: 500 },
        },
        data: { quality: 'HIGH' },
      }),
      prisma.work.updateMany({
        where: {
          status: 'PUBLISHED',
          quality: 'HIGH',
          OR: [{ rating: { lt: 4.8 } }, { ratingCount: { lt: 20 } }, { downloads: { lt: 500 } }],
        },
        data: { quality: 'NORMAL' },
      }),
    ]);
    return { upgraded: upgrade.count, downgraded: downgrade.count };
  },
};
