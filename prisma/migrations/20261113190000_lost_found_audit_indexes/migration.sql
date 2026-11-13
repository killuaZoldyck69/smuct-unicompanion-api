-- Composite indexes to support Lost & Found default feed filtering,
-- user listing queries, and pending-claim quota checks without sequential scans.
CREATE INDEX IF NOT EXISTS "lost_found_post_authorId_status_createdAt_idx"
ON "lost_found_post"("authorId", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "lost_found_post_isHiddenByModeration_status_createdAt_idx"
ON "lost_found_post"("isHiddenByModeration", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "lost_found_claim_claimantId_status_idx"
ON "lost_found_claim"("claimantId", "status");
