/*
  Warnings:

  - Added the required column `faculty` to the `StudentProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `program` to the `StudentProfile` table without a default value. This is not possible if the table is not empty.
  - Made the column `section` on table `StudentProfile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `faculty` on table `TeacherProfile` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "faculty" TEXT NOT NULL,
ADD COLUMN     "linkedInUrl" TEXT,
ADD COLUMN     "personalWebsiteUrl" TEXT,
ADD COLUMN     "program" TEXT NOT NULL,
ADD COLUMN     "skills" TEXT[],
ALTER COLUMN "section" SET NOT NULL;

-- AlterTable
ALTER TABLE "TeacherProfile" ALTER COLUMN "faculty" SET NOT NULL;
