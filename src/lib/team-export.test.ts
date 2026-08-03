import assert from "node:assert/strict";
import test from "node:test";
import type {
  BadgeDefinition,
  PokemonEntry,
  TrainerProfile,
} from "@/lib/challenge-types";
import { redactCompetitivePokemonDetails } from "@/lib/pokemon-privacy";
import {
  formatTrainerTeamExport,
  formatTrainerTeamShowdown,
  trainerBoardPath,
} from "@/lib/team-export";

const BADGES: BadgeDefinition[] = [
  {
    key: "stone",
    label: "Stone",
    category: "gym",
    sortOrder: 1,
  },
  {
    key: "knuckle",
    label: "Knuckle",
    category: "gym",
    sortOrder: 2,
  },
];

function mon(partial: Partial<PokemonEntry> & Pick<PokemonEntry, "slot" | "species">): PokemonEntry {
  return {
    id: partial.id ?? `p-${partial.species}-${partial.slot}`,
    slot: partial.slot,
    partyIndex: partial.partyIndex ?? 0,
    nickname: partial.nickname ?? null,
    species: partial.species,
    pokedexId: partial.pokedexId ?? null,
    isShiny: partial.isShiny ?? false,
    types: partial.types ?? ["Electric"],
    nature: partial.nature ?? null,
    level: partial.level ?? 20,
    ability: partial.ability ?? null,
    catchRoute: partial.catchRoute ?? null,
    heldItem: partial.heldItem ?? null,
    moves: partial.moves ?? [],
    ivs: partial.ivs ?? null,
    evs: partial.evs ?? null,
    causeOfDeath: partial.causeOfDeath ?? null,
    diedOnRun: partial.diedOnRun ?? null,
    runId: partial.runId ?? null,
  };
}

function trainer(pokemon: PokemonEntry[]): TrainerProfile {
  return {
    id: "trainer-1",
    handle: "Ash",
    realName: null,
    avatarSpriteKey: "brendan",
    avatarBackgroundKey: null,
    cardBackgroundKey: null,
    statusText: null,
    statusEmoji: null,
    reviveUsed: false,
    wipeCount: 1,
    activeRunNumber: 2,
    money: null,
    mainSquadLocked: false,
    sortOrder: 0,
    userId: "user-1",
    discordUsername: null,
    discordDisplayName: null,
    earnedBadgeKeys: ["stone", "knuckle"],
    pokemon,
    updatedAt: null,
  };
}

const URLS = {
  challengeName: "Trash Pack 2026",
  challengeGame: "Modern Emerald",
  challengeSlug: "trash-pack-2026",
  boardUrl: "https://example.com/challenges/trash-pack-2026/trainers/trainer-1",
  typeChartUrl:
    "https://example.com/challenges/trash-pack-2026/tools?tool=chart",
  guideUrl: "https://example.com/challenges/trash-pack-2026/tools?tool=guide",
  badges: BADGES,
};

test("trainerBoardPath uses shareable trainers URL", () => {
  assert.equal(
    trainerBoardPath("trash-pack-2026", "abc"),
    "/challenges/trash-pack-2026/trainers/abc",
  );
});

test("formatTrainerTeamExport includes preamble and living roster only", () => {
  const profile = trainer([
    mon({
      slot: "MAIN",
      partyIndex: 0,
      nickname: "Sparky",
      species: "Pikachu",
      pokedexId: 25,
      level: 28,
      types: ["Electric"],
      nature: "Timid",
      ability: "Static",
      heldItem: "Light Ball",
      catchRoute: "Route 110",
      moves: ["Thunderbolt", "Quick Attack"],
      ivs: { hp: 31, atk: 0, def: 20, spa: 31, spd: 20, spe: 31 },
      evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
    }),
    mon({
      slot: "RESERVE",
      partyIndex: 0,
      species: "Geodude",
      pokedexId: 74,
      types: ["Rock", "Ground"],
      level: 18,
    }),
    mon({
      slot: "GRAVEYARD",
      partyIndex: 0,
      species: "Zigzagoon",
      types: ["Normal"],
      level: 10,
      causeOfDeath: "Crit",
    }),
    mon({
      slot: "ENCOUNTERED",
      partyIndex: 0,
      species: "Oddish",
      types: ["Grass", "Poison"],
      level: 5,
    }),
  ]);

  const text = formatTrainerTeamExport(profile, {
    ...URLS,
    showCompetitiveDetails: true,
  });

  assert.match(text, /# Modern Emerald Nuzlocke — Trash Pack 2026/);
  assert.match(text, /Trainer: Ash · Run 2 · Wipes: 1 · Badges: Stone, Knuckle/);
  assert.match(text, /Board: https:\/\/example\.com\/challenges\/trash-pack-2026\/trainers\/trainer-1/);
  assert.match(text, /Suggest a Main Squad of up to 6/);
  assert.match(text, /Type chart: .*tool=chart/);
  assert.match(text, /Guide: .*tool=guide/);
  assert.match(text, /## Main Squad/);
  assert.match(text, /Sparky \(Pikachu\)/);
  assert.match(text, /Nature: Timid · Ability: Static/);
  assert.match(text, /Thunderbolt/);
  assert.match(text, /IVs:/);
  assert.match(text, /EVs:/);
  assert.match(text, /## Reserves/);
  assert.match(text, /Geodude/);
  assert.doesNotMatch(text, /Zigzagoon/);
  assert.doesNotMatch(text, /Oddish/);
});

test("formatTrainerTeamExport redacts competitive fields for spectators", () => {
  const full = trainer([
    mon({
      slot: "MAIN",
      partyIndex: 0,
      nickname: "Sparky",
      species: "Pikachu",
      pokedexId: 25,
      level: 28,
      types: ["Electric"],
      nature: "Timid",
      ability: "Static",
      heldItem: "Light Ball",
      catchRoute: "Route 110",
      moves: ["Thunderbolt"],
      ivs: { hp: 31, atk: 0, def: 20, spa: 31, spd: 20, spe: 31 },
      evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
    }),
  ]);

  // Mirror page: redact then export with showCompetitiveDetails false.
  const redacted = {
    ...full,
    pokemon: full.pokemon.map(redactCompetitivePokemonDetails),
  };

  const text = formatTrainerTeamExport(redacted, {
    ...URLS,
    showCompetitiveDetails: false,
  });

  assert.match(text, /Sparky \(Pikachu\)/);
  assert.match(text, /Item: Light Ball/);
  assert.match(text, /Caught: Route 110/);
  assert.doesNotMatch(text, /Nature:/);
  assert.doesNotMatch(text, /Ability:/);
  assert.doesNotMatch(text, /Moves:/);
  assert.doesNotMatch(text, /IVs:/);
  assert.doesNotMatch(text, /EVs:/);
  assert.doesNotMatch(text, /Playstyle:/);
  assert.doesNotMatch(text, /Timid/);
  assert.doesNotMatch(text, /Thunderbolt/);
});

test("formatTrainerTeamExport orders by partyIndex and handles empty squads", () => {
  const profile = trainer([
    mon({ slot: "MAIN", partyIndex: 2, species: "Third", types: ["Normal"] }),
    mon({ slot: "MAIN", partyIndex: 0, species: "First", types: ["Normal"] }),
    mon({ slot: "MAIN", partyIndex: 1, species: "Second", types: ["Normal"] }),
  ]);

  const text = formatTrainerTeamExport(profile, {
    ...URLS,
    showCompetitiveDetails: true,
  });

  const first = text.indexOf("1. First");
  const second = text.indexOf("2. Second");
  const third = text.indexOf("3. Third");
  assert.ok(first >= 0 && second > first && third > second);
  assert.match(text, /## Reserves\n\(none\)/);
});

test("formatTrainerTeamShowdown emits Showdown / PokePaste sets", () => {
  const profile = trainer([
    mon({
      slot: "MAIN",
      partyIndex: 0,
      nickname: "Sparky",
      species: "Pikachu",
      pokedexId: 25,
      level: 28,
      isShiny: true,
      nature: "Timid",
      ability: "Static",
      heldItem: "Light Ball",
      moves: ["Thunderbolt", "Quick Attack"],
      ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
      evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
    }),
    mon({
      slot: "RESERVE",
      partyIndex: 0,
      species: "Geodude",
      pokedexId: 74,
      level: 18,
      types: ["Rock", "Ground"],
    }),
    mon({
      slot: "GRAVEYARD",
      partyIndex: 0,
      species: "Zigzagoon",
      types: ["Normal"],
    }),
  ]);

  const text = formatTrainerTeamShowdown(profile, {
    showCompetitiveDetails: true,
  });

  assert.doesNotMatch(text, /\/\//);
  assert.match(text, /Sparky \(Pikachu\) @ Light Ball/);
  assert.match(text, /Ability: Static/);
  assert.match(text, /Level: 28/);
  assert.match(text, /Shiny: Yes/);
  assert.match(text, /EVs: 252 SpA \/ 4 SpD \/ 252 Spe/);
  assert.match(text, /Timid Nature/);
  assert.match(text, /IVs: 0 Atk/);
  assert.match(text, /- Thunderbolt/);
  assert.match(text, /- Quick Attack/);
  assert.doesNotMatch(text, /Geodude/);
  assert.doesNotMatch(text, /Zigzagoon/);
});

test("formatTrainerTeamShowdown redacts competitive fields for spectators", () => {
  const full = trainer([
    mon({
      slot: "MAIN",
      partyIndex: 0,
      nickname: "Sparky",
      species: "Pikachu",
      level: 28,
      nature: "Timid",
      ability: "Static",
      heldItem: "Light Ball",
      moves: ["Thunderbolt"],
      ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
      evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
    }),
  ]);
  const redacted = {
    ...full,
    pokemon: full.pokemon.map(redactCompetitivePokemonDetails),
  };

  const text = formatTrainerTeamShowdown(redacted, {
    showCompetitiveDetails: false,
  });

  assert.match(text, /Sparky \(Pikachu\) @ Light Ball/);
  assert.match(text, /Level: 28/);
  assert.doesNotMatch(text, /Ability:/);
  assert.doesNotMatch(text, /Nature/);
  assert.doesNotMatch(text, /EVs:/);
  assert.doesNotMatch(text, /IVs:/);
  assert.doesNotMatch(text, /Thunderbolt/);
});

test("formatTrainerTeamShowdown empty main squad is blank", () => {
  const text = formatTrainerTeamShowdown(
    trainer([
      mon({
        slot: "RESERVE",
        partyIndex: 0,
        species: "Geodude",
        types: ["Rock", "Ground"],
      }),
    ]),
    { showCompetitiveDetails: true },
  );
  assert.equal(text, "");
});
