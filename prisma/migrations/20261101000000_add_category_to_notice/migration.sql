-- Add category column to Notice table
-- Migration: add_category_to_notice

ALTER TABLE "Notice" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'GENERAL';

-- Add index on category for fast filtering
CREATE INDEX IF NOT EXISTS "Notice_category_idx" ON "Notice"("category");
