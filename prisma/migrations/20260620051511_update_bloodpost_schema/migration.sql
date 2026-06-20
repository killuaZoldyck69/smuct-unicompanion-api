/*
  Warnings:

  - Added the required column `patientCondition` to the `BloodPost` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BloodPost" ADD COLUMN     "patientCondition" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "BloodResponse" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "responderId" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BloodResponse_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BloodResponse" ADD CONSTRAINT "BloodResponse_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BloodPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodResponse" ADD CONSTRAINT "BloodResponse_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
