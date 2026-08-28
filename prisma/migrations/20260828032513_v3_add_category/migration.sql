-- CreateEnum
CREATE TYPE "Category" AS ENUM ('COURSE', 'EXAM', 'CAREER', 'TUTOR', 'LIFE', 'CAMPUS');

-- AlterTable
ALTER TABLE "works" ADD COLUMN     "category" "Category" NOT NULL DEFAULT 'COURSE';
