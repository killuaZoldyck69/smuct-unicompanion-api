-- Idempotency support for Lost & Found post creation (cold-start / double-tap retry safety)
ALTER TABLE "lost_found_post" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "lost_found_post_authorId_idempotencyKey_key"
ON "lost_found_post"("authorId", "idempotencyKey");

-- Composite indexes for Lost & Found type-filtered feed queries
CREATE INDEX IF NOT EXISTS "lost_found_post_isHiddenByModeration_type_createdAt_idx"
ON "lost_found_post"("isHiddenByModeration", "type", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "lost_found_post_isHiddenByModeration_type_status_createdAt_idx"
ON "lost_found_post"("isHiddenByModeration", "type", "status", "createdAt" DESC);

-- Exact and array media lookup indexes (avoid sequential scans on media reference & delete guards)
CREATE INDEX IF NOT EXISTS "lost_found_post_images_gin_idx"
ON "lost_found_post" USING gin ("images");

CREATE INDEX IF NOT EXISTS "lost_found_claim_proofImage_idx"
ON "lost_found_claim"("proofImage");

-- Trigram indexes for case-insensitive search across title/description/location and proofImage matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "lost_found_post_title_trgm_idx"
ON "lost_found_post" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "lost_found_post_description_trgm_idx"
ON "lost_found_post" USING gin ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "lost_found_post_location_trgm_idx"
ON "lost_found_post" USING gin ("location" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "lost_found_claim_proofImage_trgm_idx"
ON "lost_found_claim" USING gin ("proofImage" gin_trgm_ops);
