import assert from "node:assert/strict";
import test from "node:test";
import {
  experienceForLevel,
  growthRateForPokedexId,
  levelFromExperience,
  levelFromExperienceForSpecies,
  type GrowthRate,
} from "@/lib/gen3-save/experience";

/** Known (level, exp) anchors from Bulbapedia / pret formulas. */
const ANCHORS: { rate: GrowthRate; level: number; exp: number }[] = [
  { rate: "medium-fast", level: 50, exp: 125_000 },
  { rate: "medium-fast", level: 100, exp: 1_000_000 },
  { rate: "fast", level: 100, exp: 800_000 },
  { rate: "slow", level: 100, exp: 1_250_000 },
  { rate: "medium-slow", level: 100, exp: 1_059_860 },
  { rate: "erratic", level: 100, exp: 600_000 },
  { rate: "fluctuating", level: 100, exp: 1_640_000 },
  { rate: "erratic", level: 50, exp: 125_000 },
  { rate: "medium-slow", level: 50, exp: 117_360 },
  { rate: "fast", level: 50, exp: 100_000 },
  { rate: "slow", level: 50, exp: 156_250 },
  { rate: "fluctuating", level: 50, exp: 142_500 },
];

test("experienceForLevel matches known Gen 3 anchors", () => {
  for (const { rate, level, exp } of ANCHORS) {
    assert.equal(
      experienceForLevel(level, rate),
      exp,
      `${rate} Lv${level}`,
    );
  }
  for (const rate of [
    "erratic",
    "fast",
    "medium-fast",
    "medium-slow",
    "slow",
    "fluctuating",
  ] as const) {
    assert.equal(experienceForLevel(1, rate), 0);
  }
});

test("levelFromExperience is inverse of experienceForLevel at anchors", () => {
  for (const { rate, level, exp } of ANCHORS) {
    assert.equal(levelFromExperience(exp, rate), level, `${rate} @ ${exp}`);
    // Midway to next level (when not already 100) stays on current level.
    if (level < 100) {
      const next = experienceForLevel(level + 1, rate);
      const mid = exp + Math.floor((next - exp) / 2);
      assert.equal(levelFromExperience(mid, rate), level);
    }
  }
  assert.equal(levelFromExperience(-1, "medium-fast"), null);
});

test("growth catalog maps common species", () => {
  // Bulbasaur medium-slow; Caterpie medium-fast; Growlithe slow; Magikarp slow
  assert.equal(growthRateForPokedexId(1), "medium-slow");
  assert.equal(growthRateForPokedexId(10), "medium-fast");
  assert.equal(growthRateForPokedexId(58), "slow");
  assert.equal(growthRateForPokedexId(129), "slow");
  assert.equal(growthRateForPokedexId(0), null);
  assert.equal(growthRateForPokedexId(null), null);
});

test("levelFromExperienceForSpecies soft-fails unknown dex", () => {
  assert.equal(levelFromExperienceForSpecies(125_000, 1), 50); // Bulbasaur
  assert.equal(levelFromExperienceForSpecies(125_000, 99999), null);
});
