-- Per-run revive + closed-run badge archive + snapshot→run link.

ALTER TABLE "TrainerRun" ADD COLUMN "reviveUsed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TrainerRun" ADD COLUMN "earnedBadgeKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "TrainerBoardSnapshot" ADD COLUMN "runId" TEXT;
CREATE INDEX "TrainerBoardSnapshot_runId_createdAt_idx" ON "TrainerBoardSnapshot"("runId", "createdAt");

ALTER TABLE "TrainerBoardSnapshot"
  ADD CONSTRAINT "TrainerBoardSnapshot_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "TrainerRun"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Active run inherits the profile's current revive flag (season → per-run migrate).
UPDATE "TrainerRun" r
SET "reviveUsed" = t."reviveUsed"
FROM "TrainerProfile" t
WHERE r.id = t."activeRunId"
  AND t."reviveUsed" = true;

-- Closed runs: badge keys from pre-wipe snapshots (payload.wipeCount = wipeCountAtStart).
UPDATE "TrainerRun" r
SET "earnedBadgeKeys" = COALESCE(
  (
    SELECT ARRAY(
      SELECT jsonb_array_elements_text(s.payload::jsonb -> 'earnedBadgeKeys')
    )
    FROM "TrainerBoardSnapshot" s
    WHERE s."trainerId" = r."trainerId"
      AND s.trigger = 'WIPE'
      AND COALESCE((s.payload::jsonb ->> 'wipeCount')::int, -1) = r."wipeCountAtStart"
    ORDER BY s."createdAt" DESC
    LIMIT 1
  ),
  ARRAY[]::TEXT[]
)
WHERE r.status = 'CLOSED'
  AND cardinality(r."earnedBadgeKeys") = 0;

-- Closed runs: revive from matching wipe snapshot when available.
UPDATE "TrainerRun" r
SET "reviveUsed" = COALESCE(
  (
    SELECT (s.payload::jsonb ->> 'reviveUsed')::boolean
    FROM "TrainerBoardSnapshot" s
    WHERE s."trainerId" = r."trainerId"
      AND s.trigger = 'WIPE'
      AND COALESCE((s.payload::jsonb ->> 'wipeCount')::int, -1) = r."wipeCountAtStart"
    ORDER BY s."createdAt" DESC
    LIMIT 1
  ),
  false
)
WHERE r.status = 'CLOSED';

-- Attach snapshots to runs: prefer active run when wipeCount matches living attempt,
-- else closed run where wipeCountAtStart = payload.wipeCount.
UPDATE "TrainerBoardSnapshot" s
SET "runId" = r.id
FROM "TrainerRun" r
WHERE s."runId" IS NULL
  AND r."trainerId" = s."trainerId"
  AND r.status = 'CLOSED'
  AND COALESCE((s.payload::jsonb ->> 'wipeCount')::int, -1) = r."wipeCountAtStart"
  AND s.trigger IN ('WIPE', 'IMPORT', 'GM_RESET');

UPDATE "TrainerBoardSnapshot" s
SET "runId" = t."activeRunId"
FROM "TrainerProfile" t
WHERE s."runId" IS NULL
  AND s."trainerId" = t.id
  AND t."activeRunId" IS NOT NULL
  AND COALESCE((s.payload::jsonb ->> 'wipeCount')::int, -1) = t."wipeCount";
