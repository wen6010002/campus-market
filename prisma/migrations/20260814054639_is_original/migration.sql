-- DropIndex
DROP INDEX "works_course_trgm_idx";

-- DropIndex
DROP INDEX "works_description_trgm_idx";

-- DropIndex
DROP INDEX "works_title_trgm_idx";

-- AlterTable
ALTER TABLE "works" ADD COLUMN     "isOriginal" BOOLEAN NOT NULL DEFAULT true;
