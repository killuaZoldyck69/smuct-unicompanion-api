-- CreateIndex
CREATE INDEX IF NOT EXISTS "HubAnnouncement_hubId_createdAt_idx" ON "HubAnnouncement"("hubId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HubDiscussion_hubId_createdAt_idx" ON "HubDiscussion"("hubId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Resource_hubId_createdAt_idx" ON "Resource"("hubId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CourseReview_hubId_createdAt_idx" ON "CourseReview"("hubId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Submission_assessmentId_createdAt_idx" ON "Submission"("assessmentId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnnouncementComment_announcementId_parentId_createdAt_idx" ON "AnnouncementComment"("announcementId", "parentId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HubDiscussionReply_discussionId_createdAt_idx" ON "HubDiscussionReply"("discussionId", "createdAt");
