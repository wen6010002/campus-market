-- V5：密码版本会话失效 + 清理 Auth.js 备用死表
-- 注意：不触碰 trgm GIN 索引（手写 SQL 于 v4_trgm_search_idx 创建，schema.prisma 无法声明，
-- prisma migrate dev 对比时会误生成 DROP INDEX——本迁移已人工剔除）。
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pwdVersion" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE IF EXISTS "verification_tokens";
