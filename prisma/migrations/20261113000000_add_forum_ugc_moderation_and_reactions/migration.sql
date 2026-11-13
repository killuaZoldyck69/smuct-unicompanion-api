-- Enums for Forum Response Reactions & UGC Moderation
DO $$ BEGIN
    CREATE TYPE "ForumReactionType" AS ENUM ('LIKE', 'DISLIKE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "UgcReportTargetType" AS ENUM ('FORUM_POST', 'FORUM_RESPONSE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "UgcReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'HATE_SPEECH', 'INAPPROPRIATE', 'ACADEMIC_MISCONDUCT', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "UgcReportStatus" AS ENUM ('PENDING', 'DISMISSED', 'ACTIONED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User Community Guidelines Consent Timestamp
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ugcTermsAcceptedAt" TIMESTAMP(3);

-- Moderation visibility flags on Forum Posts & Responses
ALTER TABLE "HelpPost" ADD COLUMN IF NOT EXISTS "isHiddenByModeration" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HelpPost" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);

ALTER TABLE "HelpResponse" ADD COLUMN IF NOT EXISTS "isHiddenByModeration" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HelpResponse" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "HelpPost_isHiddenByModeration_createdAt_idx"
    ON "HelpPost"("isHiddenByModeration", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "HelpPost_isHiddenByModeration_isResolved_createdAt_idx"
    ON "HelpPost"("isHiddenByModeration", "isResolved", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "HelpResponse_postId_isHiddenByModeration_parentId_idx"
    ON "HelpResponse"("postId", "isHiddenByModeration", "parentId");

-- User Blocking Table (Unilateral, Campus Hub reusable)
CREATE TABLE IF NOT EXISTS "user_block" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_block_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_block_blockerId_blockedUserId_key"
    ON "user_block"("blockerId", "blockedUserId");

CREATE INDEX IF NOT EXISTS "user_block_blockerId_createdAt_idx"
    ON "user_block"("blockerId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "user_block_blockedUserId_idx"
    ON "user_block"("blockedUserId");

DO $$ BEGIN
    ALTER TABLE "user_block"
        ADD CONSTRAINT "user_block_blockerId_fkey"
        FOREIGN KEY ("blockerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "user_block"
        ADD CONSTRAINT "user_block_blockedUserId_fkey"
        FOREIGN KEY ("blockedUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Forum Response Like/Dislike Reactions
CREATE TABLE IF NOT EXISTS "help_response_reaction" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ForumReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_response_reaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "help_response_reaction_responseId_userId_key"
    ON "help_response_reaction"("responseId", "userId");

CREATE INDEX IF NOT EXISTS "help_response_reaction_responseId_type_idx"
    ON "help_response_reaction"("responseId", "type");

CREATE INDEX IF NOT EXISTS "help_response_reaction_userId_idx"
    ON "help_response_reaction"("userId");

DO $$ BEGIN
    ALTER TABLE "help_response_reaction"
        ADD CONSTRAINT "help_response_reaction_responseId_fkey"
        FOREIGN KEY ("responseId") REFERENCES "HelpResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "help_response_reaction"
        ADD CONSTRAINT "help_response_reaction_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Polymorphic UGC Content Reports Queue
CREATE TABLE IF NOT EXISTS "content_report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "UgcReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetAuthorId" TEXT,
    "reason" "UgcReportReason" NOT NULL,
    "details" TEXT,
    "targetSnapshot" JSONB,
    "status" "UgcReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_report_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "content_report_reporterId_targetType_targetId_key"
    ON "content_report"("reporterId", "targetType", "targetId");

CREATE INDEX IF NOT EXISTS "content_report_status_createdAt_idx"
    ON "content_report"("status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "content_report_targetType_targetId_status_idx"
    ON "content_report"("targetType", "targetId", "status");

CREATE INDEX IF NOT EXISTS "content_report_reporterId_targetType_status_idx"
    ON "content_report"("reporterId", "targetType", "status");

CREATE INDEX IF NOT EXISTS "content_report_targetAuthorId_idx"
    ON "content_report"("targetAuthorId");

DO $$ BEGIN
    ALTER TABLE "content_report"
        ADD CONSTRAINT "content_report_reporterId_fkey"
        FOREIGN KEY ("reporterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "content_report"
        ADD CONSTRAINT "content_report_targetAuthorId_fkey"
        FOREIGN KEY ("targetAuthorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "content_report"
        ADD CONSTRAINT "content_report_reviewedById_fkey"
        FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
