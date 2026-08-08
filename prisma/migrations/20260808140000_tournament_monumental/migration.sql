-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('SINGLE_ELIM', 'SWISS');

-- DropUniqueIndex (allow many tournaments per season)
DROP INDEX IF EXISTS "Tournament_challengeId_key";

-- AlterTable Tournament
ALTER TABLE "Tournament" ADD COLUMN "format" "TournamentFormat" NOT NULL DEFAULT 'SINGLE_ELIM';
ALTER TABLE "Tournament" ADD COLUMN "swissRoundCount" INTEGER;

-- AlterTable TournamentMatch (squad snapshots + Pokepaste)
ALTER TABLE "TournamentMatch" ADD COLUMN "squadA" JSONB;
ALTER TABLE "TournamentMatch" ADD COLUMN "squadB" JSONB;
ALTER TABLE "TournamentMatch" ADD COLUMN "pokepasteA" TEXT;
ALTER TABLE "TournamentMatch" ADD COLUMN "pokepasteB" TEXT;
ALTER TABLE "TournamentMatch" ADD COLUMN "lockedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Tournament_challengeId_createdAt_idx" ON "Tournament"("challengeId", "createdAt");

-- CreateTable
CREATE TABLE "TournamentStanding" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "buchholz" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentStanding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TournamentStanding_tournamentId_points_idx" ON "TournamentStanding"("tournamentId", "points");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentStanding_tournamentId_trainerId_key" ON "TournamentStanding"("tournamentId", "trainerId");

-- AddForeignKey
ALTER TABLE "TournamentStanding" ADD CONSTRAINT "TournamentStanding_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentStanding" ADD CONSTRAINT "TournamentStanding_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
