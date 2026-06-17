/*
  Warnings:

  - The `bloodGroup` column on the `user` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `bloodGroup` on the `BloodPost` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- AlterTable
ALTER TABLE "BloodPost" DROP COLUMN "bloodGroup",
ADD COLUMN     "bloodGroup" "BloodGroup" NOT NULL;

-- AlterTable
ALTER TABLE "user" DROP COLUMN "bloodGroup",
ADD COLUMN     "bloodGroup" "BloodGroup";
