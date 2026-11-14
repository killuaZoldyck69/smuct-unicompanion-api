-- Extend UGC report target enum for Campus Hub Memes
ALTER TYPE "UgcReportTargetType" ADD VALUE IF NOT EXISTS 'MEME_POST';

-- Add idempotency, denormalized reaction counters, and UGC moderation fields to Meme
ALTER TABLE "meme"
ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
ADD COLUMN IF NOT EXISTS "likesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "dislikesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "popularityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "isHiddenByModeration" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);

-- Backfill reaction counters and popularityScore for existing memes
UPDATE "meme" m
SET
  "likesCount" = COALESCE(counts.likes_count, 0),
  "dislikesCount" = COALESCE(counts.dislikes_count, 0),
  "popularityScore" = COALESCE(counts.likes_count, 0) * 2 - COALESCE(counts.dislikes_count, 0)
FROM (
  SELECT
    "memeId",
    COUNT(*) FILTER (WHERE "type" = 'LIKE')::INTEGER AS likes_count,
    COUNT(*) FILTER (WHERE "type" = 'DISLIKE')::INTEGER AS dislikes_count
  FROM "meme_reaction"
  GROUP BY "memeId"
) counts
WHERE m."id" = counts."memeId";

-- Per-author idempotency unique index and composite feed/moderation indexes
CREATE UNIQUE INDEX IF NOT EXISTS "meme_authorId_idempotencyKey_key"
ON "meme"("authorId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "meme_authorId_createdAt_idx"
ON "meme"("authorId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "meme_isHiddenByModeration_createdAt_idx"
ON "meme"("isHiddenByModeration", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "meme_isHiddenByModeration_popularityScore_createdAt_idx"
ON "meme"("isHiddenByModeration", "popularityScore" DESC, "createdAt" DESC);
