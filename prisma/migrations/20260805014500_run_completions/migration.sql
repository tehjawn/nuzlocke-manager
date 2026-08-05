-- Run completions: a run can now end in victory, and ending a run is a distinct
-- step from starting the next one.

ALTER TYPE "TrainerRunEndReason" ADD VALUE IF NOT EXISTS 'VICTORY';
ALTER TYPE "BoardSnapshotTrigger" ADD VALUE IF NOT EXISTS 'VICTORY';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'RUN_COMPLETED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'RUN_STARTED';

-- Championship finishes this season. Separate from wipeCount, which stays the
-- closed-run counter.
ALTER TABLE "TrainerProfile"
  ADD COLUMN IF NOT EXISTS "completionCount" INTEGER NOT NULL DEFAULT 0;

-- Non-null while the run is closed but the next one has not started: the live
-- board is the final team, frozen.
ALTER TABLE "TrainerProfile"
  ADD COLUMN IF NOT EXISTS "runEndedAt" TIMESTAMP(3);
