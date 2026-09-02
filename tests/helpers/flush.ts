import { PrismaClient } from '@prisma/client';
import { redis } from '../../src/server/lib/redis';

const TABLES = [
  'users',
  'student_profiles',
  'creator_profiles',
  'works',
  'tags',
  'work_tags',
  'work_ratings',
  'rating_tags',
  'work_rating_tags',
  'comments',
  'orders',
  'downloads',
  'follows',
  'favorites',
  'likes',
  'dynamics',
  'wallets',
  'creator_incomes',
  'payouts',
  'notifications',
  'reports',
  'audit_logs',
  'achievements',
  'user_achievements',
  'announcements',
  'announcement_reads',
  'roadmaps',
  'roadmap_work_links',
  'roadmap_favorites',
  'roadmap_checks',
] as const;

/** 清空所有表（按依赖顺序，TRUNCATE ... CASCADE 兜底）+ 清业务缓存（V4.1 起服务层有 Redis 缓存，
 *  不清会导致跨用例读到上一个用例的缓存结果；只删缓存前缀，不动限流 key）。 */
export async function flushDb(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
  await flushCache();
}

const CACHE_PREFIXES = [
  'works:list:*',
  'work:detail:*',
  'rank:*',
  'search:*',
  'announcements:list:*',
  'roadmaps:list:*',
  'roadmap:detail:*',
  'user:status:*',
  'me:*',
];

/** 只清业务缓存（单独导出：不需要重灌库的用例可用） */
export async function flushCache() {
  for (const pattern of CACHE_PREFIXES) {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(...keys);
  }
}
