-- Survive/Die polls on living MAIN + RESERVE Pokémon (issue #189).

CREATE TYPE "SurvivalPrediction" AS ENUM ('SURVIVE', 'DIE');

CREATE TYPE "SurvivalMarketStatus" AS ENUM (
  'OPEN',
  'RESOLVED_SURVIVE',
  'RESOLVED_DIE',
  'VOID'
);

ALTER TABLE "Challenge"
  ADD COLUMN IF NOT EXISTS "survivalMarketsEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "SurvivalMarket" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "trainerId" TEXT NOT NULL,
  "runId" TEXT,
  "pokemonId" TEXT,
  "species" TEXT NOT NULL,
  "nickname" TEXT,
  "pokedexId" INTEGER,
  "isShiny" BOOLEAN NOT NULL DEFAULT false,
  "status" "SurvivalMarketStatus" NOT NULL DEFAULT 'OPEN',
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SurvivalMarket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurvivalVote" (
  "id" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "prediction" "SurvivalPrediction" NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SurvivalVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SurvivalMarket_pokemonId_key" ON "SurvivalMarket"("pokemonId");

CREATE INDEX "SurvivalMarket_challengeId_status_idx" ON "SurvivalMarket"("challengeId", "status");

CREATE INDEX "SurvivalMarket_trainerId_runId_idx" ON "SurvivalMarket"("trainerId", "runId");

CREATE INDEX "SurvivalMarket_runId_status_idx" ON "SurvivalMarket"("runId", "status");

CREATE UNIQUE INDEX "SurvivalVote_marketId_userId_key" ON "SurvivalVote"("marketId", "userId");

CREATE INDEX "SurvivalVote_userId_createdAt_idx" ON "SurvivalVote"("userId", "createdAt");

ALTER TABLE "SurvivalMarket"
  ADD CONSTRAINT "SurvivalMarket_challengeId_fkey"
  FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SurvivalMarket"
  ADD CONSTRAINT "SurvivalMarket_pokemonId_fkey"
  FOREIGN KEY ("pokemonId") REFERENCES "PokemonEntry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SurvivalVote"
  ADD CONSTRAINT "SurvivalVote_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "SurvivalMarket"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SurvivalVote"
  ADD CONSTRAINT "SurvivalVote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
