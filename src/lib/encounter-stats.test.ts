import assert from "node:assert/strict";
import test from "node:test";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import {
  encounterSeasonHighlights,
  exclusiveOwnedSpecies,
  missingModernEmeraldSpecies,
  personalMissingModernEmerald,
} from "@/lib/encounter-stats";
import {
  modernEmeraldDexTotal,
  modernEmeraldNationalIds,
} from "@/lib/modern-emerald-dex";

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

function trainer(
  partial: Pick<TrainerProfile, "id" | "handle" | "sortOrder"> & {
    pokemon: PokemonEntry[];
  } & Partial<TrainerProfile>,
): TrainerProfile {
  return {
    realName: null,
    avatarSpriteKey: "brendan",
    avatarBackgroundKey: null,
    cardBackgroundKey: null,
    statusText: null,
    statusEmoji: null,
    reviveUsed: false,
    wipeCount: 0,
    activeRunNumber: 1,
    mainSquadLocked: false,
    userId: null,
    discordUsername: null,
    discordDisplayName: null,
    earnedBadgeKeys: [],
    updatedAt: null,
    ...partial,
  };
}

test("modernEmeraldNationalIds is unique, positive, and stable-sized", () => {
  const ids = modernEmeraldNationalIds();
  assert.ok(ids.length >= 386);
  assert.equal(ids.length, modernEmeraldDexTotal());
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id > 0));
  assert.ok(ids.includes(1));
  assert.ok(ids.includes(386));
  assert.ok(ids.includes(470)); // Leafeon (ME extra)
});

test("encounterSeasonHighlights ranks most/least logged and hottest route", () => {
  const highlights = encounterSeasonHighlights([
    trainer({
      id: "t1",
      handle: "Ash",
      sortOrder: 0,
      pokemon: [
        mon({
          id: "a1",
          slot: "MAIN",
          partyIndex: 0,
          species: "Zigzagoon",
          pokedexId: 263,
          catchRoute: "Route 101",
        }),
        mon({
          id: "a2",
          slot: "ENCOUNTERED",
          partyIndex: 0,
          species: "Zigzagoon",
          pokedexId: 263,
          catchRoute: "Route 101",
        }),
        mon({
          id: "a3",
          slot: "RESERVE",
          partyIndex: 0,
          species: "Absol",
          pokedexId: 359,
          catchRoute: "Route 120",
        }),
      ],
    }),
    trainer({
      id: "t2",
      handle: "May",
      sortOrder: 1,
      pokemon: [
        mon({
          id: "b1",
          slot: "MAIN",
          partyIndex: 0,
          species: "Zigzagoon",
          pokedexId: 263,
          catchRoute: "Route 101",
        }),
      ],
    }),
  ]);

  assert.equal(highlights.totalLogged, 4);
  assert.equal(highlights.uniqueSpecies, 2);
  assert.equal(highlights.routesClaimed, 2);
  assert.deepEqual(highlights.mostLogged, {
    species: "Zigzagoon",
    pokedexId: 263,
    count: 3,
    tied: false,
  });
  assert.deepEqual(highlights.leastLogged, {
    species: "Absol",
    pokedexId: 359,
    count: 1,
    tied: false,
  });
  assert.equal(highlights.hottestRoute?.route, "Route 101");
  assert.equal(highlights.hottestRoute?.claimCount, 3);
  assert.equal(highlights.hottestRoute?.trainerCount, 2);
  assert.equal(highlights.meDexLogged, 2);
  assert.equal(highlights.meDexTotal, modernEmeraldDexTotal());
});

test("missingModernEmeraldSpecies excludes touched ids including ENCOUNTERED stubs", () => {
  const missing = missingModernEmeraldSpecies([
    trainer({
      id: "t1",
      handle: "Ash",
      sortOrder: 0,
      pokemon: [
        mon({
          id: "a1",
          slot: "ENCOUNTERED",
          partyIndex: 0,
          species: "Bulbasaur",
          pokedexId: 1,
        }),
      ],
    }),
  ]);

  assert.ok(!missing.some((entry) => entry.pokedexId === 1));
  assert.ok(missing.some((entry) => entry.pokedexId === 4));
  assert.equal(missing.length, modernEmeraldDexTotal() - 1);
});

test("exclusiveOwnedSpecies requires Main/Reserve monopoly", () => {
  const exclusives = exclusiveOwnedSpecies([
    trainer({
      id: "t1",
      handle: "Ash",
      sortOrder: 0,
      pokemon: [
        mon({
          id: "a1",
          slot: "MAIN",
          partyIndex: 0,
          species: "Heracross",
          pokedexId: 214,
        }),
        mon({
          id: "a2",
          slot: "GRAVEYARD",
          partyIndex: 0,
          species: "Absol",
          pokedexId: 359,
        }),
        mon({
          id: "a3",
          slot: "ENCOUNTERED",
          partyIndex: 0,
          species: "Ditto",
          pokedexId: 132,
        }),
      ],
    }),
    trainer({
      id: "t2",
      handle: "May",
      sortOrder: 1,
      pokemon: [
        mon({
          id: "b1",
          slot: "RESERVE",
          partyIndex: 0,
          species: "Heracross",
          pokedexId: 214,
        }),
        mon({
          id: "b2",
          slot: "MAIN",
          partyIndex: 0,
          species: "Absol",
          pokedexId: 359,
        }),
      ],
    }),
  ]);

  assert.equal(exclusives.length, 1);
  assert.deepEqual(exclusives[0], {
    pokedexId: 359,
    species: "Absol",
    trainerId: "t2",
    trainerHandle: "May",
    slot: "MAIN",
  });
});

test("personalMissingModernEmerald is relative to one trainer board", () => {
  const trainers = [
    trainer({
      id: "t1",
      handle: "Ash",
      sortOrder: 0,
      pokemon: [
        mon({
          id: "a1",
          slot: "MAIN",
          partyIndex: 0,
          species: "Treecko",
          pokedexId: 252,
        }),
      ],
    }),
    trainer({
      id: "t2",
      handle: "May",
      sortOrder: 1,
      pokemon: [
        mon({
          id: "b1",
          slot: "MAIN",
          partyIndex: 0,
          species: "Torchic",
          pokedexId: 255,
        }),
      ],
    }),
  ];

  const ashGaps = personalMissingModernEmerald(trainers, "t1");
  assert.ok(ashGaps.some((entry) => entry.pokedexId === 255));
  assert.ok(!ashGaps.some((entry) => entry.pokedexId === 252));
  assert.equal(ashGaps.length, modernEmeraldDexTotal() - 1);
});

test("encounterSeasonHighlights merges species with and without pokedexId", () => {
  const highlights = encounterSeasonHighlights([
    trainer({
      id: "t1",
      handle: "Ash",
      sortOrder: 0,
      pokemon: [
        mon({
          id: "a1",
          slot: "MAIN",
          partyIndex: 0,
          species: "Zigzagoon",
          pokedexId: 263,
        }),
        mon({
          id: "a2",
          slot: "RESERVE",
          partyIndex: 0,
          species: "Zigzagoon",
          pokedexId: null,
        }),
      ],
    }),
  ]);

  assert.deepEqual(highlights.mostLogged, {
    species: "Zigzagoon",
    pokedexId: 263,
    count: 2,
    tied: false,
  });
  assert.equal(highlights.uniqueSpecies, 1);
});
