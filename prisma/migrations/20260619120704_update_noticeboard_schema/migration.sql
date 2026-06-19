/*
  Warnings:

  - You are about to drop the column `category` on the `Notice` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Notice` table. All the data in the column will be lost.
  - You are about to drop the column `driveUrl` on the `Notice` table. All the data in the column will be lost.
  - Added the required column `body` to the `Notice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `issuerDesignation` to the `Notice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `issuerName` to the `Notice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Notice" DROP COLUMN "category",
DROP COLUMN "description",
DROP COLUMN "driveUrl",
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "copyTo" TEXT[],
ADD COLUMN     "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "issuerDesignation" TEXT NOT NULL,
ADD COLUMN     "issuerName" TEXT NOT NULL,
ADD COLUMN     "referenceNo" TEXT;
