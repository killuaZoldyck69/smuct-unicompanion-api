-- AlterTable: Make description and location optional in lost_found_post
ALTER TABLE "lost_found_post" ALTER COLUMN "description" DROP NOT NULL;
ALTER TABLE "lost_found_post" ALTER COLUMN "location" DROP NOT NULL;

-- DropTable: Remove unused lost_found_comment table
DROP TABLE IF EXISTS "lost_found_comment" CASCADE;

