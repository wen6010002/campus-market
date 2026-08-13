import { PrismaClient } from '@prisma/client';

// Prisma 单例（dev 下避免热重载反复建连接）
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
