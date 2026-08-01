-- TrainerRun ledger + active pointer + pokemon.runId (backward-compatible).

CREATE TYPE "TrainerRunStatus" AS ENUM ('ACTIVE', 'CLOSED');
CREATE TYPE "TrainerRunEndReason" AS ENUM ('WIPE', 'GM_RESET');

CREATE TABLE "TrainerRun" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "status" "TrainerRunStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endReason" "TrainerRunEndReason",
    "wipeCountAtStart" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainerRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainerRun_trainerId_runNumber_key" ON "TrainerRun"("trainerId", "runNumber");
CREATE INDEX "TrainerRun_trainerId_status_idx" ON "TrainerRun"("trainerId", "status");

ALTER TABLE "TrainerRun"
  ADD CONSTRAINT "TrainerRun_trainerId_fkey"
  FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainerProfile" ADD COLUMN "activeRunId" TEXT;
CREATE UNIQUE INDEX "TrainerProfile_activeRunId_key" ON "TrainerProfile"("activeRunId");

ALTER TABLE "PokemonEntry" ADD COLUMN "runId" TEXT;
CREATE INDEX "PokemonEntry_runId_idx" ON "PokemonEntry"("runId");

ALTER TABLE "PokemonEntry"
  ADD CONSTRAINT "PokemonEntry_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "TrainerRun"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- One claimed trainer per user per season (unclaimed boards remain allowed).
CREATE UNIQUE INDEX "TrainerProfile_challengeId_userId_key"
  ON "TrainerProfile"("challengeId", "userId")
  WHERE "userId" IS NOT NULL;

-- Backfill closed + active runs from wipeCount.
-- For wipeCount = W: runs 1..W CLOSED (WIPE), run W+1 ACTIVE.
WITH trainer_runs AS (
  SELECT
    t.id AS "trainerId",
    t."wipeCount",
    gs AS "runNumber",
    CASE WHEN gs <= t."wipeCount" THEN 'CLOSED'::"TrainerRunStatus" ELSE 'ACTIVE'::"TrainerRunStatus" END AS status,
    CASE WHEN gs <= t."wipeCount" THEN 'WIPE'::"TrainerRunEndReason" ELSE NULL END AS "endReason",
    gs - 1 AS "wipeCountAtStart",
    t."createdAt" + ((gs - 1) * INTERVAL '1 second') AS "startedAt",
    CASE
      WHEN gs <= t."wipeCount" THEN t."createdAt" + (gs * INTERVAL '1 second')
      ELSE NULL
    END AS "endedAt"
  FROM "TrainerProfile" t
  CROSS JOIN LATERAL generate_series(1, t."wipeCount" + 1) AS gs
)
INSERT INTO "TrainerRun" (
  "id",
  "trainerId",
  "runNumber",
  "status",
  "startedAt",
  "endedAt",
  "endReason",
  "wipeCountAtStart",
  "createdAt",
  "updatedAt"
)
SELECT
  'run_' || "trainerId" || '_' || "runNumber",
  "trainerId",
  "runNumber",
  status,
  "startedAt",
  "endedAt",
  "endReason",
  "wipeCountAtStart",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM trainer_runs;

UPDATE "TrainerProfile" t
SET "activeRunId" = r.id
FROM "TrainerRun" r
WHERE r."trainerId" = t.id
  AND r.status = 'ACTIVE';

-- Link graves to the run they died on (diedOnRun), else leave null.
UPDATE "PokemonEntry" p
SET "runId" = r.id
FROM "TrainerRun" r
WHERE p."trainerId" = r."trainerId"
  AND p.slot = 'GRAVEYARD'
  AND p."diedOnRun" IS NOT NULL
  AND r."runNumber" = p."diedOnRun";

-- Living + encountered board belongs to the active run.
UPDATE "PokemonEntry" p
SET "runId" = t."activeRunId"
FROM "TrainerProfile" t
WHERE p."trainerId" = t.id
  AND p.slot IN ('MAIN', 'RESERVE', 'ENCOUNTERED')
  AND t."activeRunId" IS NOT NULL
  AND p."runId" IS NULL;

-- Active-run FK after backfill (TrainerRun rows must exist first).
ALTER TABLE "TrainerProfile"
  ADD CONSTRAINT "TrainerProfile_activeRunId_fkey"
  FOREIGN KEY ("activeRunId") REFERENCES "TrainerRun"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
