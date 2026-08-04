import assert from "node:assert/strict";
import test from "node:test";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import {
  encounterSeasonHighlights,
  encounterSpeciesRarity,
  exclusiveOwnedSpecies,
  groupExclusivesByLine,
  missingModernEmeraldSpecies,
  personalSpeciesStatus,
  speciesOwnershipBoard,
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

test("speciesOwnershipBoard tiers owned > encountered > untouched", () => {
  const board = speciesOwnershipBoard([
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
        mon({
          id: "a2",
          slot: "ENCOUNTERED",
          partyIndex: 0,
          species: "Torchic",
          pokedexId: 255,
        }),
        mon({
          id: "a3",
          slot: "GRAVEYARD",
          partyIndex: 0,
          species: "Mudkip",
          pokedexId: 258,
        }),
      ],
    }),
  ]);

  const byDex = new Map(board.map((entry) => [entry.pokedexId, entry]));

  const treecko = byDex.get(252)!;
  assert.equal(treecko.status, "owned");
  assert.deepEqual(treecko.owners, [
    { trainerId: "t1", trainerHandle: "Ash", slot: "MAIN" },
  ]);

  const torchic = byDex.get(255)!;
  assert.equal(torchic.status, "encountered");
  assert.deepEqual(torchic.encounteredBy, [
    { trainerId: "t1", trainerHandle: "Ash", slot: "ENCOUNTERED" },
  ]);

  // A grave counts as "encountered" (caught once, not currently held) —
  // not "untouched" and not "owned".
  const mudkip = byDex.get(258)!;
  assert.equal(mudkip.status, "encountered");
  assert.deepEqual(mudkip.encounteredBy, [
    { trainerId: "t1", trainerHandle: "Ash", slot: "GRAVEYARD" },
  ]);

  const bulbasaur = byDex.get(1)!;
  assert.equal(bulbasaur.status, "untouched");
  assert.equal(bulbasaur.owners.length, 0);
  assert.equal(bulbasaur.encounteredBy.length, 0);

  assert.equal(board.length, modernEmeraldDexTotal());
});

test("personalSpeciesStatus re-tiers a board entry relative to one trainer", () => {
  const board = speciesOwnershipBoard([
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
      ],
    }),
    trainer({
      id: "t2",
      handle: "May",
      sortOrder: 1,
      pokemon: [
        mon({
          id: "b1",
          slot: "ENCOUNTERED",
          partyIndex: 0,
          species: "Heracross",
          pokedexId: 214,
        }),
      ],
    }),
  ]);

  const heracross = board.find((entry) => entry.pokedexId === 214)!;
  assert.equal(heracross.status, "owned"); // pack-wide: Ash owns it
  assert.equal(personalSpeciesStatus(heracross, "t1"), "owned");
  assert.equal(personalSpeciesStatus(heracross, "t2"), "encountered");
  assert.equal(personalSpeciesStatus(heracross, "t3"), "untouched");
});

test("groupExclusivesByLine groups stages under their line's base form", () => {
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
          species: "Treecko",
          pokedexId: 252,
        }),
        mon({
          id: "a2",
          slot: "RESERVE",
          partyIndex: 0,
          species: "Grovyle",
          pokedexId: 253,
        }),
        mon({
          id: "a3",
          slot: "MAIN",
          partyIndex: 1,
          species: "Sceptile",
          pokedexId: 254,
        }),
        mon({
          id: "a4",
          slot: "MAIN",
          partyIndex: 2,
          species: "Heracross",
          pokedexId: 214,
        }),
      ],
    }),
  ]);

  const groups = groupExclusivesByLine(exclusives);
  const treeckoLine = groups.find((g) => g.rootPokedexId === 252)!;
  assert.equal(treeckoLine.rootSpecies, "Treecko");
  assert.equal(treeckoLine.entries.length, 3);
  assert.equal(treeckoLine.singleTrainer, true);
  assert.deepEqual(
    treeckoLine.entries.map((e) => e.pokedexId),
    [252, 253, 254],
  );

  const heracrossLine = groups.find((g) => g.rootPokedexId === 214)!;
  assert.equal(heracrossLine.entries.length, 1);
  assert.equal(heracrossLine.singleTrainer, true);
});

test("groupExclusivesByLine does not credit partial split ownership of a line", () => {
  // john: Sandslash · uwu: Sandshrew — neither owns the whole line.
  const exclusives = exclusiveOwnedSpecies([
    trainer({
      id: "john",
      handle: "john",
      sortOrder: 0,
      pokemon: [
        mon({
          id: "j1",
          slot: "MAIN",
          partyIndex: 0,
          species: "Sandslash",
          pokedexId: 28,
        }),
      ],
    }),
    trainer({
      id: "uwu",
      handle: "uwu",
      sortOrder: 1,
      pokemon: [
        mon({
          id: "u1",
          slot: "MAIN",
          partyIndex: 0,
          species: "Sandshrew",
          pokedexId: 27,
        }),
      ],
    }),
  ]);

  const groups = groupExclusivesByLine(exclusives);
  assert.equal(groups.length, 1);
  const line = groups[0]!;
  assert.equal(line.rootPokedexId, 27);
  assert.equal(line.singleTrainer, false);
  assert.equal(line.entries.length, 2);

  // Viewer-scoping must happen after grouping — filtering uwu's stages alone
  // would wrongly look like a complete single-trainer line.
  const uwuOnly = groupExclusivesByLine(
    exclusives.filter((entry) => entry.trainerId === "uwu"),
  );
  // Pre-filter is incomplete data; callers must not use it for ownership.
  // With only Sandshrew present the family is still incomplete.
  assert.equal(uwuOnly[0]!.singleTrainer, false);
});

test("groupExclusivesByLine treats branching families as one line", () => {
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
          species: "Eevee",
          pokedexId: 133,
        }),
        mon({
          id: "a2",
          slot: "RESERVE",
          partyIndex: 0,
          species: "Jolteon",
          pokedexId: 135,
        }),
        mon({
          id: "a3",
          slot: "MAIN",
          partyIndex: 1,
          species: "Umbreon",
          pokedexId: 197,
        }),
      ],
    }),
  ]);

  const groups = groupExclusivesByLine(exclusives);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.rootPokedexId, 133);
  assert.equal(groups[0]!.entries.length, 3);
  // Family has 9 members (Eevee + 8 evolutions) — three stages is incomplete.
  assert.equal(groups[0]!.singleTrainer, false);
});

test("groupExclusivesByLine never marks a line complete with a missing middle stage", () => {
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
          species: "Treecko",
          pokedexId: 252,
        }),
        mon({
          id: "a2",
          slot: "MAIN",
          partyIndex: 1,
          species: "Sceptile",
          pokedexId: 254,
        }),
      ],
    }),
  ]);

  const groups = groupExclusivesByLine(exclusives);
  const treeckoLine = groups.find((g) => g.rootPokedexId === 252)!;
  assert.equal(treeckoLine.entries.length, 2);
  assert.equal(treeckoLine.singleTrainer, false);
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
