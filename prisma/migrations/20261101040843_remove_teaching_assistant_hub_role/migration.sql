ALTER TABLE "HubMember"
ALTER COLUMN "role" TYPE TEXT USING "role"::TEXT;

UPDATE "HubMember"
SET "role" = 'STUDENT'
WHERE "role" = 'TA';

CREATE TYPE "HubRole_new" AS ENUM ('TEACHER', 'CR', 'STUDENT');

ALTER TABLE "HubMember"
ALTER COLUMN "role" TYPE "HubRole_new" USING "role"::"HubRole_new";

DROP TYPE "HubRole";

ALTER TYPE "HubRole_new" RENAME TO "HubRole";
