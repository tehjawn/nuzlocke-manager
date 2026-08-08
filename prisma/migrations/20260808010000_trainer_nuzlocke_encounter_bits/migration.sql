-- AlterTable
ALTER TABLE "TrainerProfile" ADD COLUMN "nuzlockeEncounterBits" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "TrainerProfile" ADD COLUMN "nuzlockeEncounterBitsReliable" BOOLEAN NOT NULL DEFAULT false;
