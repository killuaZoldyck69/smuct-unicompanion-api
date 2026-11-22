-- Add optional slot-level start time scoping to ClassNotice for hubs with multiple same-day sessions
ALTER TABLE "ClassNotice" ADD COLUMN IF NOT EXISTS "targetStartTime" TEXT;
