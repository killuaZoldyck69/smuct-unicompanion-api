-- AlterEnum
ALTER TYPE "ComplaintStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Complaint_deletedAt_idx" ON "Complaint"("deletedAt");
CREATE INDEX IF NOT EXISTS "Complaint_status_createdAt_idx" ON "Complaint"("status", "createdAt" DESC);
