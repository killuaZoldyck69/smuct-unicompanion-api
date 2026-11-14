-- Index Meme.imageUrl for indexed foreign-owner & active-reference media lookups
CREATE INDEX IF NOT EXISTS "meme_imageUrl_idx"
ON "meme"("imageUrl");
