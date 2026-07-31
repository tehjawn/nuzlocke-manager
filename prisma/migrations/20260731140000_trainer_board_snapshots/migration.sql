-- CreateEnum
CREATE TYPE "BoardSnapshotTrigger" AS ENUM ('IMPORT', 'WIPE', 'GM_RESET');

-- CreateTable
CREATE TABLE "TrainerBoardSnapshot" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "actorId" TEXT,
    "trigger" "BoardSnapshotTrigger" NOT NULL,
    "label" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerBoardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainerBoardSnapshot_trainerId_createdAt_idx" ON "TrainerBoardSnapshot"("trainerId", "createdAt");

-- CreateIndex
CREATE INDEX "TrainerBoardSnapshot_challengeId_createdAt_idx" ON "TrainerBoardSnapshot"("challengeId", "createdAt");

-- AddForeignKey
ALTER TABLE "TrainerBoardSnapshot" ADD CONSTRAINT "TrainerBoardSnapshot_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerBoardSnapshot" ADD CONSTRAINT "TrainerBoardSnapshot_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
