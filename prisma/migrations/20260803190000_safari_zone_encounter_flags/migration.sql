-- AlterTable
ALTER TABLE "TrainerProfile" ADD COLUMN "safariZoneAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "TrainerProfile" ADD COLUMN "safariZoneAreasReliable" BOOLEAN NOT NULL DEFAULT false;
