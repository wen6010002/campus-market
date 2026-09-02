import { PrismaClient } from '@prisma/client';

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
  'verification_tokens',
  'announcements',
  'announcement_reads',
  'roadmaps',
  'roadmap_work_links',
  'roadmap_favorites',
  'roadmap_checks',
] as const;

/** 清空所有表（按依赖顺序，TRUNCATE ... CASCADE 兜底） */
export async function flushDb(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}
