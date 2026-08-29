-- AlterTable
ALTER TABLE "Assessment" DROP CONSTRAINT IF EXISTS "Assessment_creatorId_fkey";
ALTER TABLE "Assessment" ALTER COLUMN "creatorId" DROP NOT NULL;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HubMember_hubId_idx" ON "HubMember"("hubId");
CREATE INDEX IF NOT EXISTS "HubMember_userId_idx" ON "HubMember"("userId");
CREATE INDEX IF NOT EXISTS "HubAnnouncement_hubId_idx" ON "HubAnnouncement"("hubId");
CREATE INDEX IF NOT EXISTS "AnnouncementComment_announcementId_idx" ON "AnnouncementComment"("announcementId");
CREATE INDEX IF NOT EXISTS "HubDiscussion_hubId_idx" ON "HubDiscussion"("hubId");
CREATE INDEX IF NOT EXISTS "HubDiscussionReply_discussionId_idx" ON "HubDiscussionReply"("discussionId");
CREATE INDEX IF NOT EXISTS "Assessment_hubId_idx" ON "Assessment"("hubId");
CREATE INDEX IF NOT EXISTS "Submission_assessmentId_idx" ON "Submission"("assessmentId");
CREATE INDEX IF NOT EXISTS "Resource_hubId_idx" ON "Resource"("hubId");
CREATE INDEX IF NOT EXISTS "HelpPost_authorId_idx" ON "HelpPost"("authorId");
CREATE INDEX IF NOT EXISTS "BloodPost_authorId_idx" ON "BloodPost"("authorId");
CREATE INDEX IF NOT EXISTS "BloodResponse_postId_idx" ON "BloodResponse"("postId");
CREATE INDEX IF NOT EXISTS "BloodResponse_responderId_idx" ON "BloodResponse"("responderId");
CREATE INDEX IF NOT EXISTS "CourseReview_hubId_idx" ON "CourseReview"("hubId");
CREATE INDEX IF NOT EXISTS "Complaint_userId_idx" ON "Complaint"("userId");
CREATE INDEX IF NOT EXISTS "FieldBooking_userId_idx" ON "FieldBooking"("userId");
CREATE INDEX IF NOT EXISTS "FieldBooking_status_bookingDate_idx" ON "FieldBooking"("status", "bookingDate");
