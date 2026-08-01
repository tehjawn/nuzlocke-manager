import assert from "node:assert/strict";
import test from "node:test";
import type { PokemonEntry } from "@/lib/challenge-types";
import {
  memorialPokemonAfterWipe,
  memorialRowsAfterWipe,
  wipeCauseOfDeath,
} from "@/lib/wipe-memorial";

function mon(
  partial: Pick<PokemonEntry, "id" | "slot" | "partyIndex" | "species"> &
    Partial<PokemonEntry>,
): PokemonEntry {
  return {
    nickname: null,
    pokedexId: null,
    isShiny: false,
    types: ["Normal"],
    nature: null,
    level: null,
    ability: null,
    catchRoute: null,
    heldItem: null,
    moves: [],
    ivs: null,
    evs: null,
    causeOfDeath: null,
    ...partial,
  };
}

test("wipeCauseOfDeath labels the wipe attempt", () => {
  assert.equal(wipeCauseOfDeath(3), "Run wiped (#3)");
});

test("memorialRowsAfterWipe keeps graves, memorializes Main/Reserve, drops Encountered", () => {
  const result = memorialRowsAfterWipe(
    [
      {
        id: "g0",
        slot: "GRAVEYARD",
        partyIndex: 0,
        causeOfDeath: "Crit",
      },
      { id: "m0", slot: "MAIN", partyIndex: 0, causeOfDeath: null },
      { id: "r0", slot: "RESERVE", partyIndex: 0, causeOfDeath: null },
      {
        id: "e0",
        slot: "ENCOUNTERED",
        partyIndex: 0,
        causeOfDeath: null,
      },
      { id: "m1", slot: "MAIN", partyIndex: 1, causeOfDeath: null },
    ],
    2,
  );

  assert.deepEqual(
    result.map((p) => p.id),
    ["g0", "m0", "m1", "r0"],
  );
  assert.ok(result.every((p) => p.slot === "GRAVEYARD"));
  assert.deepEqual(
    result.map((p) => p.partyIndex),
    [0, 1, 2, 3],
  );
  assert.equal(result[1]?.causeOfDeath, "Run wiped (#2)");
  assert.equal(result[0]?.causeOfDeath, "Crit");
});

test("memorialRowsAfterWipe preserves an existing cause of death", () => {
  const result = memorialRowsAfterWipe(
    [
      {
        id: "m0",
        slot: "MAIN",
        partyIndex: 0,
        causeOfDeath: "Already noted",
      },
    ],
    1,
  );
  assert.equal(result[0]?.causeOfDeath, "Already noted");
});

test("memorialPokemonAfterWipe preserves species payload while rewriting slot", () => {
  const result = memorialPokemonAfterWipe(
    [
      mon({
        id: "m0",
        slot: "MAIN",
        partyIndex: 0,
        species: "Mudkip",
        nickname: "Muddy",
        level: 16,
      }),
    ],
    1,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, "m0");
  assert.equal(result[0]?.slot, "GRAVEYARD");
  assert.equal(result[0]?.partyIndex, 0);
  assert.equal(result[0]?.species, "Mudkip");
  assert.equal(result[0]?.nickname, "Muddy");
  assert.equal(result[0]?.level, 16);
  assert.equal(result[0]?.causeOfDeath, "Run wiped (#1)");
});
