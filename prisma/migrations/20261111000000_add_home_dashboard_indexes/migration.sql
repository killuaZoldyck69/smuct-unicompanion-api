-- Additive performance indexes for Home screen & Admin Dashboard queries (API-12)
CREATE INDEX IF NOT EXISTS "user_role_isRestricted_idx" ON "user"("role", "isRestricted");
CREATE INDEX IF NOT EXISTS "user_isRestricted_updatedAt_idx" ON "user"("isRestricted", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "user_createdAt_idx" ON "user"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "CourseHub_isArchived_createdAt_idx" ON "CourseHub"("isArchived", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "CourseHub_department_idx" ON "CourseHub"("department");
CREATE INDEX IF NOT EXISTS "HubMember_userId_isActive_idx" ON "HubMember"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "HubMember_hubId_role_isActive_idx" ON "HubMember"("hubId", "role", "isActive");
CREATE INDEX IF NOT EXISTS "Assessment_hubId_deadline_idx" ON "Assessment"("hubId", "deadline");
CREATE INDEX IF NOT EXISTS "ClassNotice_hubId_isActive_effectiveDate_idx" ON "ClassNotice"("hubId", "isActive", "effectiveDate");
