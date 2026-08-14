import { PrismaClient } from '@prisma/client';

// Prisma 单例（dev 下避免热重载反复建连接）
// 运行时优先走 PgBouncer 连接池（DATABASE_URL_POOLED），未配置回退直连。
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL } },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
