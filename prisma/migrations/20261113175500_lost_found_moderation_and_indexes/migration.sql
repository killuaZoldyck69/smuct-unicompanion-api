-- Extend UGC report target enum for Lost & Found listings
ALTER TYPE "UgcReportTargetType" ADD VALUE IF NOT EXISTS 'LOST_FOUND_POST';

-- Track claim attempt count to allow 1 clean resubmission after rejection
ALTER TABLE "lost_found_claim"
ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 1;

-- Add UGC moderation visibility fields to Lost & Found listings
ALTER TABLE "lost_found_post"
ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "isHiddenByModeration" BOOLEAN NOT NULL DEFAULT false;

-- Composite feed & moderation sort indexes
CREATE INDEX IF NOT EXISTS "lost_found_post_authorId_createdAt_idx"
ON "lost_found_post"("authorId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "lost_found_post_status_type_createdAt_idx"
ON "lost_found_post"("status", "type", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "lost_found_post_category_status_createdAt_idx"
ON "lost_found_post"("category", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "lost_found_post_isHiddenByModeration_createdAt_idx"
ON "lost_found_post"("isHiddenByModeration", "createdAt" DESC);
