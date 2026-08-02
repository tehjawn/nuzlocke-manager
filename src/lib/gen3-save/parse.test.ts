import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { parsePokemonSaveAsync } from "@/lib/gen3-save/parse";

const FIXTURE_114 = path.join(
  process.cwd(),
  "fixtures/gen3-save/issue-114-encounters.state",
);

const FIXTURE_PUNCT_NICK = path.join(
  process.cwd(),
  "fixtures/gen3-save/issue-party-punct-nick.state",
);

test("Afterplay .state imports Pokédex seen-not-owned encounters (issue 114)", async () => {
  const buf = new Uint8Array(readFileSync(FIXTURE_114));
  const result = await parsePokemonSaveAsync(buf);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.match(result.format, /RZIP|state/i);
  assert.equal(result.trainer?.name, "Zevin");
  assert.deepEqual(
    result.party.map((p) => p.species),
    ["Bagon", "Combusken", "Sableye", "Gastly", "Delcatty", "Scyther"],
  );

  const encountered = new Set(result.encountered.map((p) => p.species));
  // Mid-run Nuzlocke: many seen-not-owned (this fixture has 41). The old
  // owned+40 cap rejected the real dex pair (11 owned / 52 seen).
  assert.ok(
    result.encountered.length >= 35,
    `expected many encounter stubs, got ${result.encountered.length}`,
  );
  for (const name of [
    "Sandshrew",
    "Tentacool",
    "Omanyte",
    "Hoothoot",
    "Lotad",
  ]) {
    assert.ok(encountered.has(name), `missing encounter stub: ${name}`);
  }

  // Caught mons must not also appear as encounter stubs.
  for (const name of ["Bagon", "Combusken", "Scyther", "Voltorb"]) {
    assert.ok(!encountered.has(name), `caught mon leaked into encounters: ${name}`);
  }
});

test("party survives nicknames with Gen 3 spaces and punctuation", async () => {
  const buf = new Uint8Array(readFileSync(FIXTURE_PUNCT_NICK));
  const result = await parsePokemonSaveAsync(buf);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  // Regression: a trailing "Oo oo,a a!" nick used to fail tryParseMon and
  // discard the entire 6-slot party window (leaving a stale 1-mon ghost).
  assert.deepEqual(
    result.party.map((p) => [p.species, p.nickname, p.level]),
    [
      ["Mawile", "On God", 32],
      ["Bagon", "Bagondeez", 16],
      ["Absol", "Lysol", 15],
      ["Exeggcute", "ScrambleMe", 15],
      ["Oddish", "Snoop", 18],
      ["Aipom", "Oo oo,a a!", 15],
    ],
  );
  assert.equal(result.badges.reliable, true);
  assert.deepEqual(result.badges.earnedKeys, ["gym-1", "gym-2", "gym-3"]);
  assert.ok(result.encountered.length >= 50);
});
