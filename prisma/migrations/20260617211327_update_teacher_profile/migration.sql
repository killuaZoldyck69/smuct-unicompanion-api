/*
  Warnings:

  - You are about to drop the column `specialization` on the `TeacherProfile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TeacherProfile" DROP COLUMN "specialization",
ADD COLUMN     "academicQualifications" JSONB,
ADD COLUMN     "expertiseFields" TEXT[],
ADD COLUMN     "faculty" TEXT,
ADD COLUMN     "linkedInUrl" TEXT,
ADD COLUMN     "personalWebsiteUrl" TEXT;
