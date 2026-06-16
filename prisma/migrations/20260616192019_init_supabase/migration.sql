/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `user` table. All the data in the column will be lost.
  - Added the required column `role` to the `user` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('ADMIN', 'STUDENT', 'TEACHER');

-- CreateEnum
CREATE TYPE "HubRole" AS ENUM ('TEACHER', 'CR', 'TA', 'STUDENT');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('ASSIGNMENT', 'QUIZ');

-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('ONLINE', 'HAND');

-- AlterTable
ALTER TABLE "user" DROP COLUMN "deletedAt",
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "role" "SystemRole" NOT NULL;

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "batch" TEXT NOT NULL,
    "currentSemester" INTEGER NOT NULL,
    "section" TEXT,
    "isCR" BOOLEAN NOT NULL DEFAULT false,
    "isTA" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "officeRoom" TEXT,
    "consultationHours" TEXT,
    "specialization" TEXT,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseHub" (
    "id" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "credit" DOUBLE PRECISION NOT NULL,
    "termOffer" TEXT NOT NULL,
    "weeklyClassSchedule" TEXT NOT NULL,
    "classroomNumber" TEXT,
    "midtermExamDate" TIMESTAMP(3),
    "finalExamDate" TIMESTAMP(3),
    "joinCode" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "department" TEXT NOT NULL,
    "batch" TEXT NOT NULL,
    "semesterNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseHub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "role" "HubRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "HubMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "AssessmentType" NOT NULL,
    "submissionType" "SubmissionType",
    "deadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submittedUrl" TEXT,
    "marks" DOUBLE PRECISION,
    "gradedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "driveUrl" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "hubId" TEXT,
    "isStudentNote" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpResponse" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "responderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "bloodGroup" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "isFulfilled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BloodPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseReview" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusSchedule" (
    "id" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "busNumber" TEXT NOT NULL,
    "departureTime" TEXT NOT NULL,
    "stops" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicCalendar" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "facultyOrSchool" TEXT NOT NULL,
    "driveUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "driveUrl" TEXT,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampusEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_studentId_key" ON "StudentProfile"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_userId_key" ON "TeacherProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseHub_joinCode_key" ON "CourseHub"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "HubMember_userId_hubId_key" ON "HubMember"("userId", "hubId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_assessmentId_studentId_key" ON "Submission"("assessmentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseReview_hubId_studentId_key" ON "CourseReview"("hubId", "studentId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubMember" ADD CONSTRAINT "HubMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubMember" ADD CONSTRAINT "HubMember_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "CourseHub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "CourseHub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "CourseHub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpPost" ADD CONSTRAINT "HelpPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpResponse" ADD CONSTRAINT "HelpResponse_postId_fkey" FOREIGN KEY ("postId") REFERENCES "HelpPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpResponse" ADD CONSTRAINT "HelpResponse_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodPost" ADD CONSTRAINT "BloodPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "CourseHub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
