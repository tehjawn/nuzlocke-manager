import assert from "node:assert/strict";
import test from "node:test";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import {
  encounterSeasonHighlights,
  encounterSpeciesRarity,
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
    money: null,
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

test("encounterSeasonHighlights returns top-3 lists and skips Zigzagoon", () => {
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
        mon({
          id: "a4",
          slot: "MAIN",
          partyIndex: 1,
          species: "Ralts",
          pokedexId: 280,
          catchRoute: "Route 102",
        }),
        mon({
          id: "a5",
          slot: "MAIN",
          partyIndex: 2,
          species: "Ralts",
          pokedexId: 280,
          catchRoute: "Route 102",
        }),
        mon({
          id: "a6",
          slot: "GRAVEYARD",
          partyIndex: 0,
          species: "Taillow",
          pokedexId: 276,
          catchRoute: "Route 104",
        }),
        mon({
          id: "a7",
          slot: "GRAVEYARD",
          partyIndex: 1,
          species: "Wingull",
          pokedexId: 278,
          catchRoute: "Route 104",
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
        mon({
          id: "b2",
          slot: "MAIN",
          partyIndex: 1,
          species: "Ralts",
          pokedexId: 280,
          catchRoute: "Route 102",
        }),
        mon({
          id: "b3",
          slot: "GRAVEYARD",
          partyIndex: 0,
          species: "Makuhita",
          pokedexId: 296,
          catchRoute: "Granite Cave",
        }),
      ],
    }),
  ]);

  assert.equal(highlights.totalLogged, 10);
  assert.equal(highlights.uniqueSpecies, 6);
  assert.equal(highlights.routesClaimed, 5);
  assert.deepEqual(
    highlights.mostLogged.map((e) => e.species),
    ["Ralts", "Absol", "Makuhita"],
  );
  assert.equal(highlights.mostLogged[0]?.count, 3);
  assert.ok(!highlights.mostLogged.some((e) => e.species === "Zigzagoon"));
  assert.ok(highlights.rarestSeen.every((e) => e.count === 1));
  assert.ok(!highlights.rarestSeen.some((e) => e.species === "Zigzagoon"));
  assert.deepEqual(highlights.deadliestRoutes[0], {
    route: "Route 104",
    graveCount: 2,
    trainerCount: 1,
  });
  assert.equal(highlights.meDexLogged, 6);
  assert.equal(highlights.meDexTotal, modernEmeraldDexTotal());
});

test("encounterSpeciesRarity returns the complete least-to-most ranking", () => {
  const ranking = encounterSpeciesRarity([
    trainer({
      handle: "Ash",
      id: "t1",
      pokemon: [
        mon({
          id: "a1",
          partyIndex: 0,
          pokedexId: 41,
          slot: "MAIN",
          species: "Zubat",
        }),
        mon({
          id: "a2",
          partyIndex: 0,
          pokedexId: 280,
          slot: "RESERVE",
          species: "Ralts",
        }),
        mon({
          id: "a3",
          partyIndex: 0,
          pokedexId: 359,
          slot: "ENCOUNTERED",
          species: "Absol",
        }),
        mon({
          id: "a4",
          partyIndex: 1,
          pokedexId: 304,
          slot: "ENCOUNTERED",
          species: "Aron",
        }),
        mon({
          id: "a5",
          partyIndex: 1,
          pokedexId: 263,
          slot: "MAIN",
          species: "Zigzagoon",
        }),
      ],
      sortOrder: 0,
    }),
    trainer({
      handle: "May",
      id: "t2",
      pokemon: [
        mon({
          id: "b1",
          partyIndex: 0,
          pokedexId: 41,
          slot: "GRAVEYARD",
          species: "Zubat",
        }),
        mon({
          id: "b2",
          partyIndex: 0,
          pokedexId: 280,
          slot: "MAIN",
          species: "Ralts",
        }),
        mon({
          id: "b3",
          partyIndex: 0,
          pokedexId: 280,
          slot: "RESERVE",
          species: "Ralts",
        }),
      ],
      sortOrder: 1,
    }),
  ]);

  assert.deepEqual(
    ranking.map((entry) => [entry.species, entry.count]),
    [
      ["Absol", 1],
      ["Aron", 1],
      ["Zubat", 2],
      ["Ralts", 3],
    ],
  );
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
  assert.deepEqual(personalMissingModernEmerald(trainers, "missing"), []);
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
          species: "Ralts",
          pokedexId: 280,
        }),
        mon({
          id: "a2",
          slot: "RESERVE",
          partyIndex: 0,
          species: "Ralts",
          pokedexId: null,
        }),
        mon({
          id: "a3",
          slot: "MAIN",
          partyIndex: 1,
          species: "Zigzagoon",
          pokedexId: 263,
        }),
      ],
    }),
  ]);

  assert.deepEqual(highlights.mostLogged, [
    { species: "Ralts", pokedexId: 280, count: 2 },
  ]);
  assert.equal(highlights.uniqueSpecies, 2);
});
