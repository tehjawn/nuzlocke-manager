import assert from "node:assert/strict";
import test from "node:test";
import {
  evolutionAncestors,
  evolutionConditionChips,
  evolutionReadiness,
  evolutionViewFor,
  evolutionsFrom,
  type EvolutionEdgeRaw,
} from "@/lib/species-evolutions";

test("Eevee exposes eight peer evolution options", () => {
  const opts = evolutionsFrom(133);
  assert.equal(opts.length, 8);
  const names = opts.map((o) => o.intoName).sort();
  assert.deepEqual(names, [
    "Espeon",
    "Flareon",
    "Glaceon",
    "Jolteon",
    "Leafeon",
    "Sylveon",
    "Umbreon",
    "Vaporeon",
  ]);
  const jolteon = opts.find((o) => o.intoName === "Jolteon");
  assert.ok(jolteon?.chips.some((c) => c.label === "Thunder Stone"));
  const espeon = opts.find((o) => o.intoName === "Espeon");
  assert.ok(espeon?.summary.includes("Friendship"));
  assert.ok(espeon?.summary.includes("Day"));
});

test("Scyther is a single trade+item path to Scizor", () => {
  const opts = evolutionsFrom(123);
  assert.equal(opts.length, 1);
  assert.equal(opts[0]?.intoName, "Scizor");
  assert.equal(opts[0]?.summary, "Trade · Metal Coat");
});

test("Snorunt branches to Glalie and female-morning Froslass", () => {
  const opts = evolutionsFrom(361);
  assert.equal(opts.length, 2);
  const glalie = opts.find((o) => o.intoName === "Glalie");
  const froslass = opts.find((o) => o.intoName === "Froslass");
  assert.equal(glalie?.summary, "Lv 42");
  assert.ok(froslass?.chips.some((c) => c.label === "♀"));
  assert.ok(froslass?.chips.some((c) => c.label === "Morning"));
});

test("Kirlia branches to Gardevoir and male-morning Gallade", () => {
  const opts = evolutionsFrom(281);
  assert.deepEqual(
    opts.map((o) => o.intoName).sort(),
    ["Gallade", "Gardevoir"],
  );
});

test("Tyrogue splits on ATK vs DEF", () => {
  const opts = evolutionsFrom(236);
  assert.equal(opts.length, 3);
  assert.ok(opts.some((o) => o.summary.includes("ATK > DEF")));
  assert.ok(opts.some((o) => o.summary.includes("ATK < DEF")));
  assert.ok(opts.some((o) => o.summary.includes("ATK = DEF")));
});

test("Nincada notes Shedinja as a side product", () => {
  const opts = evolutionsFrom(290);
  const shedinja = opts.find((o) => o.intoName === "Shedinja");
  assert.ok(shedinja?.note?.toLowerCase().includes("poké ball"));
  assert.ok(shedinja?.chips.some((c) => c.label.includes("Empty slot")));
});

test("Wurmple personality branches are labeled", () => {
  const opts = evolutionsFrom(265);
  assert.equal(opts.length, 2);
  assert.ok(opts.every((o) => o.summary.includes("Personality")));
});

test("level readiness reflects specimen level", () => {
  const edge: EvolutionEdgeRaw = {
    method: "EVO_LEVEL",
    paramKind: "level",
    param: 36,
    into: 6,
  };
  assert.equal(evolutionReadiness(edge, { level: 36 }).status, "ready");
  assert.equal(evolutionReadiness(edge, { level: 33 }).detail, "3 levels away");
  assert.equal(evolutionReadiness(edge, { level: 20 }).status, "blocked");
});

test("hold-item trade readiness checks held item", () => {
  const edge: EvolutionEdgeRaw = {
    method: "EVO_TRADE_ITEM",
    paramKind: "item",
    param: "Metal Coat",
    into: 212,
  };
  assert.equal(
    evolutionReadiness(edge, { heldItem: "Metal Coat" }).status,
    "ready",
  );
  assert.equal(
    evolutionReadiness(edge, { heldItem: "Leftovers" }).status,
    "blocked",
  );
});

test("move evolution readiness checks known moves", () => {
  const edge: EvolutionEdgeRaw = {
    method: "EVO_MOVE",
    paramKind: "move",
    param: "Ancient Power",
    into: 465,
  };
  assert.equal(
    evolutionReadiness(edge, { moves: ["Ancient Power", "Giga Drain"] }).status,
    "close",
  );
  assert.equal(
    evolutionReadiness(edge, { moves: ["Giga Drain"] }).status,
    "blocked",
  );
});

test("condition chips cover friendship day/night and beauty", () => {
  assert.deepEqual(
    evolutionConditionChips({
      method: "EVO_FRIENDSHIP_NIGHT",
      paramKind: "none",
      param: 0,
      into: 197,
    }).map((c) => c.label),
    ["Friendship", "Night", "Level up"],
  );
  assert.equal(
    evolutionConditionChips({
      method: "EVO_BEAUTY",
      paramKind: "beauty",
      param: 170,
      into: 350,
    })[0]?.label,
    "Beauty ≥ 170",
  );
});

test("ancestors breadcrumb walks Ralts → Kirlia for Gallade", () => {
  const chain = evolutionAncestors(475);
  assert.deepEqual(
    chain.map((c) => c.name),
    ["Ralts", "Kirlia"],
  );
});

test("evolution view hides legendaries with no evo graph entry", () => {
  assert.equal(evolutionViewFor(150), null); // Mewtwo
});

test("final form view still shows ancestors", () => {
  const view = evolutionViewFor(3); // Venusaur
  assert.ok(view);
  assert.equal(view?.isFinal, true);
  assert.deepEqual(
    view?.ancestors.map((a) => a.name),
    ["Bulbasaur", "Ivysaur"],
  );
});

test("branched mid-line (Gloom) shows both stone options", () => {
  const view = evolutionViewFor(44);
  assert.equal(view?.options.length, 2);
  assert.ok(view?.options.some((o) => o.intoName === "Vileplume"));
  assert.ok(view?.options.some((o) => o.intoName === "Bellossom"));
});
