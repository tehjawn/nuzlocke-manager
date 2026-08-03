import assert from "node:assert/strict";
import test from "node:test";
import { gen3MetLocationName } from "@/data/gen3-mapsec";

test("modern MAPSEC: Petalburg Woods is 0x3B, not Battle Frontier", () => {
  assert.equal(gen3MetLocationName(0x3b, "modern"), "Petalburg Woods");
  assert.equal(gen3MetLocationName(0x3a, "modern"), "Battle Frontier");
  assert.equal(gen3MetLocationName(0x37, "modern"), "Granite Cave");
  assert.equal(gen3MetLocationName(0xc7, "modern"), "Mirage Tower");
});

test("vanilla MAPSEC keeps legacy Battle Frontier at 59", () => {
  assert.equal(gen3MetLocationName(59, "vanilla"), "Battle Frontier");
  assert.equal(gen3MetLocationName(60, "vanilla"), "Petalburg Woods");
  assert.equal(gen3MetLocationName(56, "vanilla"), "Granite Cave");
});

test("modern is the default mapsec mode", () => {
  assert.equal(gen3MetLocationName(0x3b), "Petalburg Woods");
});

test("special met-location sentinels", () => {
  assert.equal(gen3MetLocationName(0xfd, "modern"), "Starter gift");
  assert.equal(gen3MetLocationName(0xfe, "modern"), "In-game trade");
  assert.equal(gen3MetLocationName(0xff, "modern"), "Event / gift");
});

test("modern MAPSEC splits Safari Zone into six Nuzlocke areas", () => {
  assert.equal(gen3MetLocationName(0xd8, "modern"), "Safari Zone (South)");
  assert.equal(gen3MetLocationName(0xd9, "modern"), "Safari Zone (Southwest)");
  assert.equal(gen3MetLocationName(0xda, "modern"), "Safari Zone (Northwest)");
  assert.equal(gen3MetLocationName(0xdb, "modern"), "Safari Zone (North)");
  assert.equal(gen3MetLocationName(0xdc, "modern"), "Safari Zone (Southeast)");
  assert.equal(gen3MetLocationName(0xdd, "modern"), "Safari Zone (Northeast)");
});

test("vanilla and modern region-map Safari stay the umbrella label", () => {
  assert.equal(gen3MetLocationName(0x39, "modern"), "Safari Zone");
  assert.equal(gen3MetLocationName(58, "vanilla"), "Safari Zone");
});
