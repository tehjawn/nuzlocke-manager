import assert from "node:assert/strict";
import test from "node:test";
import type { PokemonEntry } from "@/lib/challenge-types";
import {
  currentRunNumber,
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
    diedOnRun: null,
    runId: null,
    ...partial,
  };
}

test("wipeCauseOfDeath labels the wipe attempt", () => {
  assert.equal(wipeCauseOfDeath(3), "Run wiped (#3)");
});

test("currentRunNumber is wipeCount + 1", () => {
  assert.equal(currentRunNumber(0), 1);
  assert.equal(currentRunNumber(2), 3);
});

test("memorialRowsAfterWipe clears the live board (including prior graves)", () => {
  const result = memorialRowsAfterWipe(
    [
      {
        id: "g0",
        slot: "GRAVEYARD",
        partyIndex: 0,
        causeOfDeath: "Crit",
        diedOnRun: 1,
        runId: "run-1",
      },
      {
        id: "m0",
        slot: "MAIN",
        partyIndex: 0,
        causeOfDeath: null,
        diedOnRun: null,
        runId: "run-2",
      },
      {
        id: "r0",
        slot: "RESERVE",
        partyIndex: 0,
        causeOfDeath: null,
        diedOnRun: null,
        runId: "run-2",
      },
      {
        id: "e0",
        slot: "ENCOUNTERED",
        partyIndex: 0,
        causeOfDeath: null,
        diedOnRun: null,
        runId: "run-2",
      },
    ],
    2,
    "run-2",
  );

  assert.deepEqual(result, []);
});

test("memorialPokemonAfterWipe returns an empty board", () => {
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
      mon({
        id: "g0",
        slot: "GRAVEYARD",
        partyIndex: 0,
        species: "Zigzagoon",
        causeOfDeath: "Crit",
        diedOnRun: 1,
      }),
    ],
    1,
    "run-1",
  );
  assert.deepEqual(result, []);
});
