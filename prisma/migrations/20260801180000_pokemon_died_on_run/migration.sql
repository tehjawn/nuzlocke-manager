-- AlterTable
ALTER TABLE "PokemonEntry" ADD COLUMN "diedOnRun" INTEGER;

-- Backfill wipe memorials that already encode the run in cause text.
UPDATE "PokemonEntry"
SET "diedOnRun" = CAST(
  (regexp_match("causeOfDeath", 'Run wiped \(#([0-9]+)\)'))[1] AS INTEGER
)
WHERE slot = 'GRAVEYARD'
  AND "causeOfDeath" ~ 'Run wiped \(#[0-9]+\)'
  AND "diedOnRun" IS NULL;
