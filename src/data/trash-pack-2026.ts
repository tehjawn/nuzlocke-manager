import type {
  Challenge,
  PokemonEntry,
  TrainerProfile,
} from "@/lib/challenge-types";
import { DEFAULT_BADGE_DEFINITIONS } from "@/lib/constants";
import type { PokemonType } from "@/lib/pokemon-types";

type SeedChallenge = Omit<Challenge, "source" | "activities" | "id">;

function mon(
  partial: Omit<PokemonEntry, "id"> & { id?: string },
): PokemonEntry {
  return {
    id: partial.id ?? `${partial.slot}-${partial.partyIndex}-${partial.species}`,
    ...partial,
  };
}

function trainer(
  partial: Omit<TrainerProfile, "pokemon" | "userId"> & {
    pokemon?: PokemonEntry[];
    userId?: string | null;
  },
): TrainerProfile {
  return {
    userId: partial.userId ?? null,
    ...partial,
    pokemon: partial.pokemon ?? [],
  };
}

const rules = [
  {
    id: "r1",
    sortOrder: 1,
    title: "Faint = dead",
    body: "Any Pokémon that faints must be released or boxed permanently. It is considered “dead” for the rest of the challenge.",
    isCore: true,
  },
  {
    id: "r2",
    sortOrder: 2,
    title: "First encounter",
    body: "Only the first wild Pokémon encountered in a route, city, or area can be caught. If it flees or faints, the opportunity in that area is lost. Tip: Repels can help navigate toward desired encounters.",
    isCore: true,
  },
  {
    id: "r3",
    sortOrder: 3,
    title: "Nicknames",
    body: "The player must nickname all Pokémon they catch or obtain.",
    isCore: true,
  },
  {
    id: "r4",
    sortOrder: 4,
    title: "Revive Token",
    body: "Trainers may use the Revive Token on their board to reload a save after a mistake. Once used, they cannot reload a save again.",
    isCore: false,
  },
  {
    id: "r5",
    sortOrder: 5,
    title: "No duplicate held items",
    body: "No duplicate items can be equipped across your entire Pokémon team.",
    isCore: false,
  },
  {
    id: "r6",
    sortOrder: 6,
    title: "Items die with the Pokémon",
    body: "Any held item on a Pokémon that faints is lost forever. Remove the item and permanently box or release the fainted Pokémon with its gear (customize as the group agrees).",
    isCore: false,
  },
  {
    id: "r7",
    sortOrder: 7,
    title: "Keep the board honest",
    body: "Trainers must actively update their trainer board so everyone can plan around transparent conditions.",
    isCore: false,
  },
];

const faqs = [
  {
    id: "f1",
    sortOrder: 1,
    question: "What's the end goal?",
    answer:
      "Initiate a ladder tournament between everyone's Main Squad. The Main Squad locks in immediately after defeating the Champion, even if Pokémon faint in that battle. If the whole Main Squad faints during the Champion fight, retry with reserves.",
  },
  {
    id: "f2",
    sortOrder: 2,
    question: "How do I get a trainer board?",
    answer:
      "Sign in with Discord. For public seasons, you’re automatically added as a trainer and can edit your board right away. Ash Ketchum on the league board is just a demo example.",
  },
  {
    id: "f3",
    sortOrder: 3,
    question: "What if I catch a shiny?",
    answer: "Toggle Shiny on the Pokémon slot when you add or edit it.",
  },
  {
    id: "f4",
    sortOrder: 4,
    question: "How do Game Masters work?",
    answer:
      "Ask an existing GM for the GM invite code, or have them promote you from the GM console. GMs can edit everyone’s boards, rules, and FAQ.",
  },
];

/** Demo-only unclaimed trainer so the league board isn’t empty before friends join. */
const ashKetchum = trainer({
  id: "ash-ketchum",
  handle: "Ash",
  realName: "Ketchum",
  avatarSpriteKey: "red",
  statusText: "Demo trainer — not a real player. Sign in with Discord to get your own board.",
  reviveUsed: false,
  mainSquadLocked: false,
  sortOrder: 0,
  earnedBadgeKeys: ["gym-1", "gym-2", "gym-3"],
  pokemon: [
    mon({
      id: "ash-main-0",
      slot: "MAIN",
      partyIndex: 0,
      nickname: "Pikachu",
      species: "Pikachu",
      pokedexId: 25,
      isShiny: false,
      types: ["Electric"] as PokemonType[],
      nature: "Jolly",
      level: 25,
      ability: "Static",
      catchRoute: "Viridian Forest",
      heldItem: "Light Ball",
      moves: ["Thunderbolt", "Quick Attack", "Iron Tail", "Thunder Wave"],
      causeOfDeath: null,
    }),
    mon({
      id: "ash-main-1",
      slot: "MAIN",
      partyIndex: 1,
      nickname: "Charizard",
      species: "Charizard",
      pokedexId: 6,
      isShiny: false,
      types: ["Fire", "Flying"] as PokemonType[],
      nature: "Adamant",
      level: 36,
      ability: "Blaze",
      catchRoute: "Starter",
      heldItem: null,
      moves: ["Flamethrower", "Wing Attack", "Slash", "Fire Spin"],
      causeOfDeath: null,
    }),
    mon({
      id: "ash-main-2",
      slot: "MAIN",
      partyIndex: 2,
      nickname: "Bulbasaur",
      species: "Venusaur",
      pokedexId: 3,
      isShiny: false,
      types: ["Grass", "Poison"] as PokemonType[],
      nature: "Bold",
      level: 32,
      ability: "Overgrow",
      catchRoute: "Starter (trade)",
      heldItem: null,
      moves: ["Razor Leaf", "Sleep Powder", "Take Down", "Sweet Scent"],
      causeOfDeath: null,
    }),
    mon({
      id: "ash-rip-0",
      slot: "GRAVEYARD",
      partyIndex: 0,
      nickname: "Butterfree",
      species: "Butterfree",
      pokedexId: 12,
      isShiny: false,
      types: ["Bug", "Flying"] as PokemonType[],
      nature: "Timid",
      level: 18,
      ability: "Compound Eyes",
      catchRoute: "Viridian Forest",
      heldItem: null,
      moves: ["Confusion", "Gust", "Sleep Powder", "Stun Spore"],
      causeOfDeath: "Released to join a flock of Butterfree. Respect.",
    }),
  ],
});

export const trashPack2026: SeedChallenge = {
  slug: "2026-trash-pack",
  name: "Trash Pack Pokémon Nuzlocke",
  year: 2026,
  game: "Pokémon Emerald",
  description:
    "Friend-group Hoenn Nuzlocke. Sign in with Discord to get a trainer board automatically. Ash is a demo example only.",
  status: "ACTIVE",
  visibility: "PUBLIC",
  playerInviteCode: null,
  gmInviteCode: "TRASHPACK-GM",
  badges: DEFAULT_BADGE_DEFINITIONS,
  rules,
  faqs,
  trainers: [ashKetchum],
};

export const CHALLENGES: SeedChallenge[] = [trashPack2026];
