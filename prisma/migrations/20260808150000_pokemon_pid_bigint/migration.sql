-- Gen 3 PIDs / OT ids are unsigned 32-bit; INTEGER overflows at 2^31.
ALTER TABLE "PokemonEntry"
  ALTER COLUMN "personalityValue" TYPE BIGINT,
  ALTER COLUMN "otId" TYPE BIGINT;
