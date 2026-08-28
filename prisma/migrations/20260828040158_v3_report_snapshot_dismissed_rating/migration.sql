-- AlterEnum
ALTER TYPE "ReportStatus" ADD VALUE 'DISMISSED';

-- AlterEnum
ALTER TYPE "ReportTargetType" ADD VALUE 'RATING';

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "targetAuthorId" TEXT,
ADD COLUMN     "targetSnapshot" JSONB,
ADD COLUMN     "targetTitle" VARCHAR(200);

-- CreateIndex
CREATE INDEX "reports_targetType_targetId_status_idx" ON "reports"("targetType", "targetId", "status");
