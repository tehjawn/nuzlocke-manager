-- AlterTable
ALTER TABLE "TrainerProfile" ADD COLUMN IF NOT EXISTS "introCompletedAt" TIMESTAMP(3);

-- Existing trainers skip the /new-trainer funnel (only brand-new provisions need it).
UPDATE "TrainerProfile"
SET "introCompletedAt" = "createdAt"
WHERE "introCompletedAt" IS NULL;
