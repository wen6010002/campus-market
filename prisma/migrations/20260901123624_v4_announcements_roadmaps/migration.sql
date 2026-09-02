-- CreateEnum
CREATE TYPE "AnnounceLevel" AS ENUM ('NORMAL', 'IMPORTANT');

-- CreateEnum
CREATE TYPE "RoadmapCategory" AS ENUM ('BACKEND', 'FRONTEND', 'AI', 'ALGORITHM', 'EXAM', 'OTHER');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'DELETE';

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "content" TEXT NOT NULL,
    "level" "AnnounceLevel" NOT NULL DEFAULT 'NORMAL',
    "authorId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmaps" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "summary" VARCHAR(500) NOT NULL,
    "category" "RoadmapCategory" NOT NULL DEFAULT 'OTHER',
    "coverIcon" TEXT NOT NULL DEFAULT '🗺',
    "coverTheme" TEXT NOT NULL DEFAULT 'g-default',
    "uploaderId" TEXT NOT NULL,
    "status" "WorkStatus" NOT NULL DEFAULT 'PENDING',
    "stepsCount" INTEGER NOT NULL DEFAULT 0,
    "favs" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "mdSourceKey" TEXT NOT NULL,
    "credentialKey" TEXT,
    "experience" VARCHAR(500),
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "roadmaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_work_links" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "sortNo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "roadmap_work_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmap_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_checks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "stepId" VARCHAR(20) NOT NULL,
    "phaseIdx" INTEGER NOT NULL,
    "stepIdx" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmap_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcements_deletedAt_publishedAt_idx" ON "announcements"("deletedAt", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "announcement_reads_userId_idx" ON "announcement_reads"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_reads_userId_announcementId_key" ON "announcement_reads"("userId", "announcementId");

-- CreateIndex
CREATE INDEX "roadmaps_status_category_favs_idx" ON "roadmaps"("status", "category", "favs" DESC);

-- CreateIndex
CREATE INDEX "roadmaps_status_publishedAt_idx" ON "roadmaps"("status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "roadmaps_uploaderId_idx" ON "roadmaps"("uploaderId");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_work_links_roadmapId_workId_key" ON "roadmap_work_links"("roadmapId", "workId");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_favorites_userId_roadmapId_key" ON "roadmap_favorites"("userId", "roadmapId");

-- CreateIndex
CREATE INDEX "roadmap_checks_userId_roadmapId_createdAt_idx" ON "roadmap_checks"("userId", "roadmapId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_checks_userId_roadmapId_stepId_key" ON "roadmap_checks"("userId", "roadmapId", "stepId");

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_work_links" ADD CONSTRAINT "roadmap_work_links_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_work_links" ADD CONSTRAINT "roadmap_work_links_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_favorites" ADD CONSTRAINT "roadmap_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_favorites" ADD CONSTRAINT "roadmap_favorites_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_checks" ADD CONSTRAINT "roadmap_checks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_checks" ADD CONSTRAINT "roadmap_checks_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
