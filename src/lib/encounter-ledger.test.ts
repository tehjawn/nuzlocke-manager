import assert from "node:assert/strict";
import test from "node:test";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import { buildEncounterLedger } from "@/lib/encounter-ledger";

function trainer(partial: Partial<TrainerProfile>): TrainerProfile {
  return {
    activeRunNumber: 1,
    avatarBackgroundKey: null,
    avatarSpriteKey: "brendan",
    cardBackgroundKey: null,
    discordDisplayName: null,
    discordUsername: null,
    earnedBadgeKeys: [],
    handle: "Ash",
    id: "trainer-1",
    mainSquadLocked: false,
    money: null,
    pokemon: [],
    realName: null,
    reviveUsed: false,
    safariZoneAreas: [],
    safariZoneAreasReliable: false,
    sortOrder: 0,
    statusEmoji: null,
    statusText: null,
    updatedAt: null,
    userId: null,
    wipeCount: 0,
    ...partial,
  };
}

function mon(catchRoute: string): PokemonEntry {
  return {
    ability: null,
    causeOfDeath: null,
    catchRoute,
    diedOnRun: null,
    evs: null,
    heldItem: null,
    id: "mon-1",
    isShiny: false,
    ivs: null,
    level: 10,
    moves: [],
    nature: null,
    nickname: "Sneasel",
    partyIndex: 0,
    pokedexId: 215,
    runId: null,
    slot: "MAIN",
    species: "Sneasel",
    types: ["Dark"],
  };
}

test("keeps generic Safari met locations out of route claims", () => {
  const ledger = buildEncounterLedger([
    trainer({ pokemon: [mon("Safari Zone")] }),
  ]);

  assert.deepEqual(ledger, [
    {
      claims: [
        {
          isAlive: true,
          isShiny: false,
          nickname: "Sneasel",
          pokedexId: 215,
          pokemonId: "mon-1",
          slot: "MAIN",
          species: "Sneasel",
          trainerHandle: "Ash",
          trainerId: "trainer-1",
        },
      ],
      flagClaims: [],
      kind: "catch-records",
      route: "Safari Zone — unresolved catch records",
    },
  ]);
});

test("adds directional Safari route claims from imported game flags", () => {
  const ledger = buildEncounterLedger([
    trainer({
      safariZoneAreas: ["Safari Zone (South)"],
      safariZoneAreasReliable: true,
    }),
  ]);

  assert.deepEqual(ledger, [
    {
      claims: [],
      flagClaims: [{ trainerHandle: "Ash", trainerId: "trainer-1" }],
      kind: "route",
      route: "Safari Zone (South)",
    },
  ]);
});
