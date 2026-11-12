-- CreateTable: One-way HMAC guard preventing rapid delete-and-resignup churn while erasing PII
CREATE TABLE IF NOT EXISTS "account_deletion_guard" (
    "id" TEXT NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "identifierType" TEXT NOT NULL,
    "deletionCount" INTEGER NOT NULL DEFAULT 1,
    "lastDeletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3),
    "isPermanentlyBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_deletion_guard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "account_deletion_guard_identifierHash_key"
    ON "account_deletion_guard"("identifierHash");

CREATE INDEX IF NOT EXISTS "account_deletion_guard_blockedUntil_idx"
    ON "account_deletion_guard"("blockedUntil");

-- Ensure Submission.gradedById explicitly cascades SET NULL on User delete
ALTER TABLE "Submission" DROP CONSTRAINT IF EXISTS "Submission_gradedById_fkey";
ALTER TABLE "Submission"
    ADD CONSTRAINT "Submission_gradedById_fkey"
    FOREIGN KEY ("gradedById") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
