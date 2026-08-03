import assert from "node:assert/strict";
import test from "node:test";
import { modernEmeraldLearnsetFor } from "@/lib/modern-emerald-learnsets";

test("Bulbasaur includes every Modern Emerald acquisition method", () => {
  const learnset = modernEmeraldLearnsetFor(1);
  assert.ok(learnset);
  assert.ok(
    learnset.levelUp.some(
      ({ level, move }) => level === 20 && move === "Razor Leaf",
    ),
  );
  assert.deepEqual(
    learnset.levelUp.map(({ level }) => level),
    [...learnset.levelUp.map(({ level }) => level)].sort((a, b) => a - b),
  );
  assert.ok(
    learnset.tmHm.some(
      ({ machine, move }) => machine === "TM06" && move === "Toxic",
    ),
  );
  assert.ok(learnset.tutor.includes("Body Slam"));
  assert.ok(learnset.egg.includes("Light Screen"));
});

test("custom Modern Emerald level-up additions use readable move names", () => {
  const charizard = modernEmeraldLearnsetFor(6);
  assert.ok(charizard);
  assert.ok(
    charizard.levelUp.some(
      ({ level, move }) => level === 66 && move === "Dragon Pulse",
    ),
  );
});

test("unknown National Dex ids do not expose unrelated learnsets", () => {
  assert.equal(modernEmeraldLearnsetFor(0), null);
  assert.equal(modernEmeraldLearnsetFor(999_999), null);
});
