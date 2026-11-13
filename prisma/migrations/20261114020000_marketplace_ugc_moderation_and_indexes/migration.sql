-- Extend UGC report target enum for Marketplace listings and comments
ALTER TYPE "UgcReportTargetType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_POST';
ALTER TYPE "UgcReportTargetType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_COMMENT';

-- Add UGC moderation visibility fields to Marketplace listings and comments
ALTER TABLE "marketplace_post"
ADD COLUMN IF NOT EXISTS "isHiddenByModeration" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);

ALTER TABLE "marketplace_comment"
ADD COLUMN IF NOT EXISTS "isHiddenByModeration" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);

-- Composite feed, deterministic cursor sort, and moderation indexes
CREATE INDEX IF NOT EXISTS "marketplace_post_authorId_createdAt_idx"
ON "marketplace_post"("authorId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "marketplace_post_status_createdAt_id_idx"
ON "marketplace_post"("status", "createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "marketplace_post_type_status_createdAt_id_idx"
ON "marketplace_post"("type", "status", "createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "marketplace_post_category_status_createdAt_id_idx"
ON "marketplace_post"("category", "status", "createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "marketplace_post_isHiddenByModeration_status_createdAt_id_idx"
ON "marketplace_post"("isHiddenByModeration", "status", "createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "marketplace_comment_postId_isHiddenByModeration_parentId_cr_idx"
ON "marketplace_comment"("postId", "isHiddenByModeration", "parentId", "createdAt");
