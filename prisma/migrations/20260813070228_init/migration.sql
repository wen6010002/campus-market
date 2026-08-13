-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'CREATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "EduVerifyStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED', 'TAKEN_DOWN');

-- CreateEnum
CREATE TYPE "Quality" AS ENUM ('NORMAL', 'HIGH', 'SELECTED');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('PDF', 'DOC', 'DOCX', 'PPT', 'PPTX', 'ZIP', 'IMAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "PayMethod" AS ENUM ('WECHAT', 'ALIPAY', 'MOCK');

-- CreateEnum
CREATE TYPE "PayStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'CLOSED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderBizType" AS ENUM ('PURCHASE');

-- CreateEnum
CREATE TYPE "IncomeStatus" AS ENUM ('PENDING', 'SETTLED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FollowStatus" AS ENUM ('ACTIVE');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('INFRINGEMENT', 'PIRACY', 'MISMATCH', 'PORN_GAMBLE_ILLEGAL', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'PROCESSING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('WORK', 'COMMENT', 'USER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('APPROVE', 'REJECT', 'TAKE_DOWN', 'REQUEST_CHANGES');

-- CreateEnum
CREATE TYPE "DynamicType" AS ENUM ('PUBLISH', 'UPDATE', 'CHECKIN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('FOLLOW_NEW_WORK', 'INCOME', 'ARRIVED', 'RATING_REPLIED', 'AUDIT_RESULT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AchievementKey" AS ENUM ('HELP_50', 'HELP_1000', 'FIRST_FIVE_STAR', 'WEEKLY_HOT', 'COLLEGE_EXCELLENT', 'FIRST_INCOME');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordPepper" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "avatarColor" TEXT NOT NULL DEFAULT '#FF6B4A',
    "bannedAt" TIMESTAMP(3),
    "bannedReason" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eduEmail" TEXT NOT NULL,
    "school" TEXT NOT NULL,
    "college" TEXT NOT NULL,
    "major" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "studentCardKey" TEXT,
    "verifyStatus" "EduVerifyStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" VARCHAR(500) NOT NULL,
    "direction" TEXT NOT NULL,
    "honor" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "works" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(800) NOT NULL,
    "course" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileSha" TEXT,
    "pages" INTEGER NOT NULL DEFAULT 0,
    "coverIcon" TEXT NOT NULL DEFAULT '📄',
    "coverTheme" TEXT NOT NULL DEFAULT 'g-default',
    "isFree" BOOLEAN NOT NULL DEFAULT true,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "oldPrice" DECIMAL(10,2),
    "status" "WorkStatus" NOT NULL DEFAULT 'DRAFT',
    "quality" "Quality" NOT NULL DEFAULT 'NORMAL',
    "copyrightAccepted" BOOLEAN NOT NULL DEFAULT false,
    "applyMajor" TEXT,
    "applyGrade" TEXT,
    "applyCrowd" TEXT,
    "previewToc" JSONB NOT NULL,
    "rating" DECIMAL(3,1) NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "ratingDist" JSONB NOT NULL DEFAULT '{"5":0,"4":0,"3":0,"2":0,"1":0}',
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "favs" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_tags" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "work_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_ratings" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "text" VARCHAR(600) NOT NULL,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "creatorReply" VARCHAR(600),
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPositive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rating_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_rating_tags" (
    "id" TEXT NOT NULL,
    "ratingId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "work_rating_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" VARCHAR(600) NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "bizType" "OrderBizType" NOT NULL DEFAULT 'PURCHASE',
    "amount" DECIMAL(10,2) NOT NULL,
    "platformFee" DECIMAL(10,2) NOT NULL,
    "creatorAmount" DECIMAL(10,2) NOT NULL,
    "payMethod" "PayMethod" NOT NULL,
    "payStatus" "PayStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "idempotencyKey" TEXT,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downloads" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "downloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "status" "FollowStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dynamics" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "type" "DynamicType" NOT NULL,
    "workId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dynamics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pending" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "withdrawn" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_incomes" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "IncomeStatus" NOT NULL DEFAULT 'PENDING',
    "settleAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PayMethod" NOT NULL DEFAULT 'WECHAT',
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "channelTxId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "text" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "detail" VARCHAR(600),
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "handlerId" TEXT,
    "handleNote" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "key" "AchievementKey" NOT NULL,
    "emoji" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_userId_key" ON "student_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_eduEmail_key" ON "student_profiles"("eduEmail");

-- CreateIndex
CREATE UNIQUE INDEX "creator_profiles_userId_key" ON "creator_profiles"("userId");

-- CreateIndex
CREATE INDEX "works_status_quality_publishedAt_idx" ON "works"("status", "quality", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "works_authorId_status_idx" ON "works"("authorId", "status");

-- CreateIndex
CREATE INDEX "works_course_idx" ON "works"("course");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "work_tags_workId_tagId_key" ON "work_tags"("workId", "tagId");

-- CreateIndex
CREATE INDEX "work_ratings_workId_createdAt_idx" ON "work_ratings"("workId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "work_ratings_workId_userId_key" ON "work_ratings"("workId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "rating_tags_name_key" ON "rating_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "work_rating_tags_ratingId_tagId_key" ON "work_rating_tags"("ratingId", "tagId");

-- CreateIndex
CREATE INDEX "comments_workId_createdAt_idx" ON "comments"("workId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "orders_transactionId_key" ON "orders"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON "orders"("idempotencyKey");

-- CreateIndex
CREATE INDEX "orders_workId_payStatus_idx" ON "orders"("workId", "payStatus");

-- CreateIndex
CREATE INDEX "orders_buyerId_createdAt_idx" ON "orders"("buyerId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "downloads_workId_userId_key" ON "downloads"("workId", "userId");

-- CreateIndex
CREATE INDEX "follows_followingId_idx" ON "follows"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "follows_followerId_followingId_key" ON "follows"("followerId", "followingId");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_userId_workId_key" ON "favorites"("userId", "workId");

-- CreateIndex
CREATE UNIQUE INDEX "likes_userId_workId_key" ON "likes"("userId", "workId");

-- CreateIndex
CREATE INDEX "dynamics_creatorId_createdAt_idx" ON "dynamics"("creatorId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_creatorId_key" ON "wallets"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "creator_incomes_orderId_key" ON "creator_incomes"("orderId");

-- CreateIndex
CREATE INDEX "creator_incomes_status_settleAt_idx" ON "creator_incomes"("status", "settleAt");

-- CreateIndex
CREATE INDEX "payouts_creatorId_requestedAt_idx" ON "payouts"("creatorId", "requestedAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_read_createdAt_idx" ON "notifications"("userId", "read", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "reports_status_createdAt_idx" ON "reports"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_workId_createdAt_idx" ON "audit_logs"("workId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "achievements_key_key" ON "achievements"("key");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_userId_achievementId_key" ON "user_achievements"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "works" ADD CONSTRAINT "works_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tags" ADD CONSTRAINT "work_tags_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tags" ADD CONSTRAINT "work_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_ratings" ADD CONSTRAINT "work_ratings_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_ratings" ADD CONSTRAINT "work_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_rating_tags" ADD CONSTRAINT "work_rating_tags_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "work_ratings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_rating_tags" ADD CONSTRAINT "work_rating_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "rating_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamics" ADD CONSTRAINT "dynamics_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamics" ADD CONSTRAINT "dynamics_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creator_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_incomes" ADD CONSTRAINT "creator_incomes_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creator_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_incomes" ADD CONSTRAINT "creator_incomes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creator_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
