-- V12：评论区审核体系 + 每日打卡账本 + 宿舍楼
-- 由 prisma migrate diff（migrations 基线 → 新 schema）生成后手工校订：
-- 剔除对 v4_trgm_search_idx 手写 GIN 索引的 3 个 DROP INDEX
-- （schema.prisma 无法声明 gin_trgm_ops，diff 想删掉它们——历史约定保留，见 20260903120000 同款注释）。
-- 纯增量：存量行零影响（comments.status 默认 VISIBLE，旧行为不变）。

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('VISIBLE', 'PENDING_REVIEW', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WORK_COMMENTED';
ALTER TYPE "NotificationType" ADD VALUE 'COMMENT_REPLIED';
ALTER TYPE "NotificationType" ADD VALUE 'COMMENT_REJECTED';

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "modReason" VARCHAR(200),
ADD COLUMN     "modSource" VARCHAR(20),
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "roadmapId" TEXT,
ADD COLUMN     "status" "CommentStatus" NOT NULL DEFAULT 'VISIBLE',
ALTER COLUMN "workId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dorm" VARCHAR(30);

-- CreateTable
CREATE TABLE "daily_checkins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "streakDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_checkins_streakDays_idx" ON "daily_checkins"("streakDays" DESC);

-- CreateIndex
CREATE INDEX "daily_checkins_day_idx" ON "daily_checkins"("day");

-- CreateIndex
CREATE UNIQUE INDEX "daily_checkins_userId_day_key" ON "daily_checkins"("userId", "day");

-- CreateIndex
CREATE INDEX "comments_roadmapId_createdAt_idx" ON "comments"("roadmapId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "comments_status_createdAt_idx" ON "comments"("status", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
