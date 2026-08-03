import assert from "node:assert/strict";
import test from "node:test";
import { modernSafariZoneAreasFromEncounterFlags } from "@/data/safari-zone";

test("reads Modern Emerald's six Safari claims from Nuzlocke encounter flags", () => {
  const flags = new Uint8Array(9);
  flags[0x33 >> 3] = 0b0111_1000;
  flags[0x43 >> 3] = 0b0000_1000;

  assert.deepEqual(modernSafariZoneAreasFromEncounterFlags(flags), [
    "Safari Zone (South)",
    "Safari Zone (Southwest)",
    "Safari Zone (Northwest)",
    "Safari Zone (North)",
    "Safari Zone (Southeast)",
  ]);
});
