CREATE INDEX IF NOT EXISTS "AcademicCalendar_status_isActive_createdAt_idx"
ON "AcademicCalendar" ("status", "isActive", "createdAt" DESC);
