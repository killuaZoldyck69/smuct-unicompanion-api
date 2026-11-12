-- Additive performance indexes for Auth & Student Onboarding queries (API-12)
CREATE INDEX IF NOT EXISTS "user_emailVerified_createdAt_idx" ON "user"("emailVerified", "createdAt");
CREATE INDEX IF NOT EXISTS "session_expiresAt_idx" ON "session"("expiresAt");
CREATE INDEX IF NOT EXISTS "verification_expiresAt_idx" ON "verification"("expiresAt");
CREATE INDEX IF NOT EXISTS "StudentProfile_department_batch_section_idx" ON "StudentProfile"("department", "batch", "section");
CREATE INDEX IF NOT EXISTS "StudentProfile_isCR_idx" ON "StudentProfile"("isCR");
CREATE INDEX IF NOT EXISTS "TeacherProfile_department_idx" ON "TeacherProfile"("department");
