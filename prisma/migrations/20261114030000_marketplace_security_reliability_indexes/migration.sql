-- Idempotency support for Marketplace post creation (cold-start / double-tap retry safety)
ALTER TABLE "marketplace_post"
ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "marketplace_post_authorId_idempotencyKey_key"
ON "marketplace_post"("authorId", "idempotencyKey");

-- GIN index for fast exact/canonical image array ownership & orphan checks
CREATE INDEX IF NOT EXISTS "marketplace_post_images_gin_idx"
ON "marketplace_post" USING gin ("images");

-- Trigram indexes for case-insensitive marketplace feed search without sequential scans
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "marketplace_post_title_trgm_idx"
ON "marketplace_post" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "marketplace_post_description_trgm_idx"
ON "marketplace_post" USING gin ("description" gin_trgm_ops);
