-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'WIPE';

-- AlterTable
ALTER TABLE "TrainerProfile" ADD COLUMN "wipeCount" INTEGER NOT NULL DEFAULT 0;
