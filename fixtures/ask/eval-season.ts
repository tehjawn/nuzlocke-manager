import type { SearchSeasonContext } from "@/features/search/search-types";

/**
 * Tiny synthetic season for Ask evals (#395). Stable handles/species so gold
 * `mustInclude` checks stay deterministic across runs.
 */
export function buildEvalSeason(): SearchSeasonContext {
  return {
    slug: "eval-pack",
    name: "Eval Pack",
    year: 2026,
    status: "ACTIVE",
    game: "Pokémon Modern Emerald",
    showGm: false,
    myTrainerId: "t-ash",
    trainers: [
      {
        id: "t-ash",
        handle: "ash",
        realName: null,
        discordUsername: null,
        discordDisplayName: null,
        avatarSpriteKey: "brendan",
        earnedBadgeKeys: ["stone", "knuckle", "dynamo", "heat"],
        statusText: null,
        pokemon: [
          {
            id: "p1",
            slot: "MAIN",
            nickname: "Mudkip Jr",
            species: "Swampert",
            pokedexId: 260,
            isShiny: false,
            catchRoute: "Route 101",
            level: 42,
          },
          {
            id: "p2",
            slot: "MAIN",
            nickname: "Birb",
            species: "Swellow",
            pokedexId: 277,
            isShiny: false,
            catchRoute: "Route 104",
            level: 35,
          },
          {
            id: "p3",
            slot: "GRAVEYARD",
            nickname: "Ripper",
            species: "Zigzagoon",
            pokedexId: 263,
            isShiny: false,
            catchRoute: "Route 101",
            level: 8,
          },
        ],
      },
      {
        id: "t-misty",
        handle: "misty",
        realName: null,
        discordUsername: null,
        discordDisplayName: null,
        avatarSpriteKey: "may",
        earnedBadgeKeys: ["stone", "knuckle"],
        statusText: null,
        pokemon: [
          {
            id: "p4",
            slot: "MAIN",
            nickname: "Splash",
            species: "Gyarados",
            pokedexId: 130,
            isShiny: false,
            catchRoute: "Route 118",
            level: 38,
          },
          {
            id: "p5",
            slot: "MAIN",
            nickname: "Zigs",
            species: "Zigzagoon",
            pokedexId: 263,
            isShiny: false,
            catchRoute: "Route 102",
            level: 12,
          },
          {
            id: "p6",
            slot: "GRAVEYARD",
            nickname: "Bubble",
            species: "Lotad",
            pokedexId: 270,
            isShiny: false,
            catchRoute: "Route 102",
            level: 14,
          },
        ],
      },
      {
        id: "t-brock",
        handle: "brock",
        realName: null,
        discordUsername: null,
        discordDisplayName: null,
        avatarSpriteKey: "wally",
        earnedBadgeKeys: ["stone"],
        statusText: "wiped",
        pokemon: [
          {
            id: "p7",
            slot: "GRAVEYARD",
            nickname: "Rocky",
            species: "Geodude",
            pokedexId: 74,
            isShiny: false,
            catchRoute: "Granite Cave",
            level: 18,
          },
        ],
      },
    ],
    badges: [
      { key: "stone", label: "Stone Badge", category: "GYM" },
      { key: "knuckle", label: "Knuckle Badge", category: "GYM" },
      { key: "dynamo", label: "Dynamo Badge", category: "GYM" },
      { key: "heat", label: "Heat Badge", category: "GYM" },
    ],
    rules: [
      {
        id: "r1",
        title: "Dupe clause",
        body: "If you already own an evolutionary line, further encounters of that line may be skipped.",
      },
      {
        id: "r2",
        title: "Level caps",
        body: "Before Wattson, living party Pokémon may not exceed level 24.",
      },
    ],
    faqs: [
      {
        id: "f1",
        question: "Do we have to nickname Pokémon?",
        answer: "Yes — nicknames are required for every catch in this season.",
      },
      {
        id: "f2",
        question: "What counts as a wipe?",
        answer: "A wipe is when every living party and box Pokémon has fainted.",
      },
    ],
  };
}
