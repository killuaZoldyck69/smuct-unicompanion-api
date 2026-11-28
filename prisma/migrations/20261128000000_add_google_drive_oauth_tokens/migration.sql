ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "googleDriveName" TEXT,
ADD COLUMN IF NOT EXISTS "googleDriveAvatarUrl" TEXT,
ADD COLUMN IF NOT EXISTS "googleDriveRefreshTokenEnc" TEXT;
