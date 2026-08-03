import assert from "node:assert/strict";
import test from "node:test";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { memorialSeasonHighlights } from "@/lib/memorial-stats";

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

test("memorialSeasonHighlights finds heaviest memorial, party wipes, and death-prone species", () => {
  const highlights = memorialSeasonHighlights([
    trainer({
      id: "t1",
      handle: "Ash",
      sortOrder: 0,
      wipeCount: 1,
      pokemon: [
        mon({ id: "a1", slot: "GRAVEYARD", partyIndex: 0, species: "Zigzagoon", pokedexId: 263 }),
        mon({ id: "a2", slot: "GRAVEYARD", partyIndex: 1, species: "Zigzagoon", pokedexId: 263 }),
        mon({ id: "a3", slot: "MAIN", partyIndex: 0, species: "Mudkip", pokedexId: 258 }),
      ],
    }),
    trainer({
      id: "t2",
      handle: "May",
      sortOrder: 1,
      wipeCount: 3,
      pokemon: [
        mon({ id: "b1", slot: "GRAVEYARD", partyIndex: 0, species: "Zigzagoon", pokedexId: 263 }),
      ],
    }),
  ]);

  assert.equal(highlights.totalGraves, 3);
  assert.equal(highlights.trainersWithLosses, 2);
  assert.deepEqual(highlights.heaviestMemorial, {
    trainerIds: ["t1"],
    labels: ["Ash"],
    count: 2,
    tied: false,
  });
  assert.deepEqual(highlights.mostPartyWipes, {
    trainerIds: ["t2"],
    labels: ["May"],
    count: 3,
    tied: false,
  });
  assert.deepEqual(highlights.mostDeathProne, {
    species: "Zigzagoon",
    pokedexId: 263,
    count: 3,
    tied: false,
  });
});

test("memorialSeasonHighlights marks trainer ties", () => {
  const highlights = memorialSeasonHighlights([
    trainer({
      id: "t1",
      handle: "Ash",
      sortOrder: 0,
      wipeCount: 2,
      pokemon: [mon({ id: "a1", slot: "GRAVEYARD", partyIndex: 0, species: "Ralts" })],
    }),
    trainer({
      id: "t2",
      handle: "May",
      sortOrder: 1,
      wipeCount: 2,
      pokemon: [mon({ id: "b1", slot: "GRAVEYARD", partyIndex: 0, species: "Taillow" })],
    }),
  ]);

  assert.equal(highlights.heaviestMemorial?.tied, true);
  assert.deepEqual(highlights.heaviestMemorial?.labels, ["Ash", "May"]);
  assert.equal(highlights.mostPartyWipes?.tied, true);
  assert.deepEqual(highlights.mostPartyWipes?.labels, ["Ash", "May"]);
  assert.equal(highlights.mostPartyWipes?.count, 2);
});

test("memorialSeasonHighlights merges same species with and without pokedexId", () => {
  const highlights = memorialSeasonHighlights([
    trainer({
      id: "t1",
      handle: "Ash",
      sortOrder: 0,
      pokemon: [
        mon({
          id: "a1",
          slot: "GRAVEYARD",
          partyIndex: 0,
          species: "Zigzagoon",
          pokedexId: 263,
        }),
        mon({
          id: "a2",
          slot: "GRAVEYARD",
          partyIndex: 1,
          species: "Zigzagoon",
          pokedexId: null,
        }),
      ],
    }),
  ]);

  assert.deepEqual(highlights.mostDeathProne, {
    species: "Zigzagoon",
    pokedexId: 263,
    count: 2,
    tied: false,
  });
});

test("memorialSeasonHighlights omits party wipes when nobody has wiped", () => {
  const highlights = memorialSeasonHighlights([
    trainer({
      id: "t1",
      handle: "Ash",
      sortOrder: 0,
      wipeCount: 0,
      pokemon: [mon({ id: "a1", slot: "GRAVEYARD", partyIndex: 0, species: "Ralts" })],
    }),
  ]);

  assert.equal(highlights.mostPartyWipes, null);
});

test("memorialSeasonHighlights picks richest trainer by imported money", () => {
  const highlights = memorialSeasonHighlights([
    trainer({
      id: "t1",
      handle: "Broke",
      sortOrder: 0,
      money: 1200,
      pokemon: [],
    }),
    trainer({
      id: "t2",
      handle: "Loaded",
      sortOrder: 1,
      money: 482_500,
      pokemon: [],
    }),
    trainer({
      id: "t3",
      handle: "Unknown",
      sortOrder: 2,
      money: null,
      pokemon: [],
    }),
  ]);

  assert.deepEqual(highlights.richest, {
    trainerIds: ["t2"],
    labels: ["Loaded"],
    count: 482_500,
    tied: false,
  });
});
