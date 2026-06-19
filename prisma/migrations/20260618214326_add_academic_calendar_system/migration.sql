/*
  Warnings:

  - You are about to drop the column `driveUrl` on the `AcademicCalendar` table. All the data in the column will be lost.
  - You are about to drop the column `facultyOrSchool` on the `AcademicCalendar` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[teacherId]` on the table `TeacherProfile` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `semester` to the `AcademicCalendar` table without a default value. This is not possible if the table is not empty.
  - Added the required column `teacherId` to the `TeacherProfile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AcademicCalendar" DROP COLUMN "driveUrl",
DROP COLUMN "facultyOrSchool",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isGlobal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "semester" TEXT NOT NULL,
ADD COLUMN     "targetDepartments" TEXT[],
ADD COLUMN     "targetFaculties" TEXT[];

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "teacherId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_teacherId_key" ON "TeacherProfile"("teacherId");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "AcademicCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
