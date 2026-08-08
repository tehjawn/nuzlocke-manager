-- Gen 3 personality value (PID) + optional OT id for sticky save re-import.
ALTER TABLE "PokemonEntry" ADD COLUMN "personalityValue" INTEGER;
ALTER TABLE "PokemonEntry" ADD COLUMN "otId" INTEGER;

CREATE INDEX "PokemonEntry_trainerId_personalityValue_idx"
  ON "PokemonEntry"("trainerId", "personalityValue");

-- One real PID per trainer; multiple NULL PIDs (manual / dex stubs) remain allowed.
CREATE UNIQUE INDEX "PokemonEntry_trainerId_personalityValue_key"
  ON "PokemonEntry"("trainerId", "personalityValue")
  WHERE "personalityValue" IS NOT NULL;
