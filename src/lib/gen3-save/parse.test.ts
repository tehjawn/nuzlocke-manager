import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { parsePokemonSaveAsync } from "@/lib/gen3-save/parse";

const FIXTURE = path.join(
  process.cwd(),
  "fixtures/gen3-save/issue-114-encounters.state",
);

test("Afterplay .state imports Pokédex seen-not-owned encounters (issue 114)", async () => {
  const buf = new Uint8Array(readFileSync(FIXTURE));
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
