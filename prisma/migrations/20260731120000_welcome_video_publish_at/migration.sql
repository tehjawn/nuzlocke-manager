-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN "welcomeVideoPublishAt" TIMESTAMP(3);

-- Default schedule: 9:00 PM Eastern on Jul 31, 2026 (EDT = UTC-4)
UPDATE "Challenge"
SET "welcomeVideoPublishAt" = (TIMESTAMP '2026-07-31 21:00:00' AT TIME ZONE 'America/New_York')
WHERE "welcomeVideoPublishAt" IS NULL;

-- AlterTable
ALTER TABLE "Challenge" DROP COLUMN "welcomeVideoPublished";
