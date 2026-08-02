import assert from "node:assert/strict";
import test from "node:test";
import { recommendPlaystyle } from "@/lib/playstyle";

test("special attacker: Alakazam", () => {
  const hint = recommendPlaystyle({ pokedexId: 65 });
  assert.ok(hint);
  assert.equal(hint.primary, "Special attacker");
  assert.match(hint.tip, /special/i);
});

test("physical wall: Steelix", () => {
  const hint = recommendPlaystyle({ pokedexId: 208 });
  assert.ok(hint);
  assert.ok(
    hint.primary === "Physical wall" ||
      hint.primary === "Bulky" ||
      hint.primary === "Slow",
  );
  if (hint.primary !== "Slow") {
    assert.ok(
      hint.primary === "Physical wall" ||
        hint.secondary === "Physical wall" ||
        hint.primary === "Bulky" ||
        hint.secondary === "Bulky" ||
        hint.secondary === "Slow",
    );
  }
});

test("glass / fast special: Gengar", () => {
  const hint = recommendPlaystyle({ pokedexId: 94 });
  assert.ok(hint);
  assert.ok(
    ["Special attacker", "Glass cannon", "Fast"].includes(hint.primary),
  );
});

test("special wall / bulky: Blissey", () => {
  const hint = recommendPlaystyle({ pokedexId: 242 });
  assert.ok(hint);
  assert.ok(
    ["Special wall", "Bulky", "Slow"].includes(hint.primary) ||
      (hint.secondary != null &&
        ["Special wall", "Bulky", "Slow"].includes(hint.secondary)),
  );
});

test("balanced soft-fails unknown species", () => {
  assert.equal(recommendPlaystyle({ pokedexId: null }), null);
  assert.equal(recommendPlaystyle({ pokedexId: 0 }), null);
  assert.equal(recommendPlaystyle({ pokedexId: 99999 }), null);
});

test("nature helps physical attacker (Adamant Scizor)", () => {
  const hint = recommendPlaystyle({ pokedexId: 212, nature: "Adamant" });
  assert.ok(hint);
  assert.equal(hint.primary, "Physical attacker");
  assert.equal(hint.natureAlignment, "helps");
  assert.equal(hint.natureAlignmentLabel, "Nature helps");
});

test("nature fights physical attacker (Modest Scizor)", () => {
  const hint = recommendPlaystyle({ pokedexId: 212, nature: "Modest" });
  assert.ok(hint);
  assert.equal(hint.primary, "Physical attacker");
  assert.equal(hint.natureAlignment, "fights");
});

test("ability nudge for Huge Power", () => {
  const hint = recommendPlaystyle({
    pokedexId: 184, // Azumarill — bulky/phys lean
    ability: "Huge Power",
  });
  assert.ok(hint);
  assert.match(hint.tip, /Huge Power/i);
});

test("IV nudge mentions strong role stats", () => {
  const hint = recommendPlaystyle({
    pokedexId: 212,
    nature: "Adamant",
    ivs: { hp: 20, atk: 31, def: 20, spa: 0, spd: 20, spe: 31 },
  });
  assert.ok(hint);
  assert.match(hint.tip, /IVs look especially strong/i);
});
