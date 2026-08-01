import assert from "node:assert/strict";
import { test } from "node:test";
import type { PokemonEntry } from "@/lib/challenge-types";
import {
  groupSnapshotsByRun,
  memorialBackfillCandidates,
  pickMemorialSourceSnapshot,
} from "@/lib/memorial-backfill";

function mon(
  partial: Partial<PokemonEntry> &
    Pick<PokemonEntry, "id" | "slot" | "species" | "partyIndex">,
): PokemonEntry {
  return {
    nickname: null,
    pokedexId: null,
    isShiny: false,
    types: [],
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

test("pickMemorialSourceSnapshot prefers WIPE over IMPORT", () => {
  const pick = pickMemorialSourceSnapshot([
    {
      id: "imp",
      trigger: "IMPORT",
      createdAt: "2026-08-02T00:00:00.000Z",
      runId: "r1",
      wipeCount: 0,
      pokemon: [],
    },
    {
      id: "wipe",
      trigger: "WIPE",
      createdAt: "2026-08-01T00:00:00.000Z",
      runId: "r1",
      wipeCount: 0,
      pokemon: [],
    },
  ]);
  assert.equal(pick?.id, "wipe");
});

test("groupSnapshotsByRun attaches orphans by wipeCount", () => {
  const byRun = groupSnapshotsByRun(
    [
      { id: "r1", runNumber: 1, status: "CLOSED" },
      { id: "r2", runNumber: 2, status: "ACTIVE" },
    ],
    [
      {
        id: "s1",
        trigger: "WIPE",
        createdAt: "2026-08-01T00:00:00.000Z",
        runId: null,
        wipeCount: 0,
        pokemon: [],
      },
    ],
  );
  assert.equal(byRun.get("r1")?.length, 1);
  assert.equal(byRun.get("r2")?.length, 0);
});

test("memorialBackfillCandidates restores wipe victims + prior mid-run graves", () => {
  const result = memorialBackfillCandidates({
    runs: [
      { id: "r1", runNumber: 1, status: "CLOSED" },
      { id: "r2", runNumber: 2, status: "ACTIVE" },
    ],
    snapshots: [
      {
        id: "wipe-1",
        trigger: "WIPE",
        createdAt: "2026-08-01T12:00:00.000Z",
        runId: "r1",
        wipeCount: 0,
        pokemon: [
          mon({
            id: "mid",
            slot: "GRAVEYARD",
            partyIndex: 0,
            species: "Zigzagoon",
            nickname: "Ziggy",
            diedOnRun: 1,
            causeOfDeath: "Crit from Poochyena",
          }),
          mon({
            id: "alive",
            slot: "MAIN",
            partyIndex: 0,
            species: "Mudkip",
            nickname: "Muddy",
          }),
          mon({
            id: "box",
            slot: "RESERVE",
            partyIndex: 0,
            species: "Taillow",
            nickname: "Ace",
          }),
        ],
      },
    ],
    existingGraves: [],
  });

  assert.equal(result.candidates.length, 3);
  assert.deepEqual(
    result.candidates.map((c) => c.label).sort(),
    ["Ace", "Muddy", "Ziggy"],
  );
  assert.ok(result.candidates.every((c) => c.diedOnRun === 1));
  assert.ok(result.candidates.every((c) => c.runId === "r1"));
  const muddy = result.candidates.find((c) => c.label === "Muddy");
  assert.equal(muddy?.source, "wipe_end");
  assert.match(muddy?.causeOfDeath ?? "", /wiped/i);
  assert.equal(result.nextPartyIndex, 0);
  assert.deepEqual(result.runsRestored, [1]);
});

test("memorialBackfillCandidates skips species already on the live memorial", () => {
  const result = memorialBackfillCandidates({
    runs: [{ id: "r1", runNumber: 1, status: "CLOSED" }],
    snapshots: [
      {
        id: "wipe-1",
        trigger: "WIPE",
        createdAt: "2026-08-01T12:00:00.000Z",
        runId: "r1",
        wipeCount: 0,
        pokemon: [
          mon({
            id: "alive",
            slot: "MAIN",
            partyIndex: 0,
            species: "Mudkip",
            nickname: "Muddy",
          }),
          mon({
            id: "other",
            slot: "MAIN",
            partyIndex: 1,
            species: "Treecko",
            nickname: "Tree",
          }),
        ],
      },
    ],
    existingGraves: [
      { species: "Mudkip", nickname: "Muddy", partyIndex: 0 },
    ],
  });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.label, "Tree");
  assert.equal(result.nextPartyIndex, 1);
});

test("memorialBackfillCandidates restores active-run graves from import snapshot", () => {
  const result = memorialBackfillCandidates({
    runs: [{ id: "r2", runNumber: 2, status: "ACTIVE" }],
    snapshots: [
      {
        id: "imp",
        trigger: "IMPORT",
        createdAt: "2026-08-01T12:00:00.000Z",
        runId: "r2",
        wipeCount: 1,
        pokemon: [
          mon({
            id: "g1",
            slot: "GRAVEYARD",
            partyIndex: 0,
            species: "Ralts",
            nickname: "Ral",
            diedOnRun: 2,
            causeOfDeath: "Crit",
          }),
          mon({
            id: "living",
            slot: "MAIN",
            partyIndex: 0,
            species: "Swampert",
          }),
        ],
      },
    ],
    existingGraves: [],
  });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.label, "Ral");
  assert.equal(result.candidates[0]?.source, "snapshot_grave");
  assert.equal(result.candidates[0]?.diedOnRun, 2);
});

test("memorialBackfillCandidates does not pull living mons from import snapshots", () => {
  const result = memorialBackfillCandidates({
    runs: [{ id: "r1", runNumber: 1, status: "CLOSED" }],
    snapshots: [
      {
        id: "imp",
        trigger: "IMPORT",
        createdAt: "2026-08-01T12:00:00.000Z",
        runId: "r1",
        wipeCount: 0,
        pokemon: [
          mon({
            id: "g1",
            slot: "GRAVEYARD",
            partyIndex: 0,
            species: "Wurmple",
            diedOnRun: 1,
          }),
          mon({
            id: "m1",
            slot: "MAIN",
            partyIndex: 0,
            species: "Mudkip",
          }),
        ],
      },
    ],
    existingGraves: [],
  });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.species, "Wurmple");
});
