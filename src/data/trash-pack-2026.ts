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
    question: "How do sprites work?",
    answer:
      "Enter a Pokémon species on a slot and the sprite resolves automatically from open sprite sources (PokeAPI / Showdown).",
  },
  {
    id: "f3",
    sortOrder: 3,
    question: "What if I catch a shiny?",
    answer:
      "Mark it shiny on the slot (spreadsheet habit: type “(Shiny)” before the species name).",
  },
  {
    id: "f4",
    sortOrder: 4,
    question: "Help — my sprite isn’t showing!",
    answer:
      "Check the species spelling and form (e.g. Nidoran-M, Basculin-Blue-Striped). Refresh if the CDN hiccups.",
  },
];

function sampleMain(opts: {
  idPrefix: string;
  entries: Array<{
    species: string;
    pokedexId: number;
    types: PokemonType[];
    nickname: string;
    level: number;
    ability: string;
    nature: string;
    route: string;
    item?: string;
    moves: string[];
    shiny?: boolean;
  }>;
}): PokemonEntry[] {
  return opts.entries.map((e, i) =>
    mon({
      id: `${opts.idPrefix}-main-${i}`,
      slot: "MAIN",
      partyIndex: i,
      nickname: e.nickname,
      species: e.species,
      pokedexId: e.pokedexId,
      isShiny: e.shiny ?? false,
      types: e.types,
      nature: e.nature,
      level: e.level,
      ability: e.ability,
      catchRoute: e.route,
      heldItem: e.item ?? null,
      moves: e.moves,
      causeOfDeath: null,
    }),
  );
}

export const trashPack2026: SeedChallenge = {
  slug: "2026-trash-pack",
  name: "Trash Pack Pokémon Nuzlocke",
  year: 2026,
  game: "Pokémon Emerald",
  description:
    "Friend-group Hoenn Nuzlocke. Keep boards honest, honor the fallen, lock Main Squads after the Champion, then ladder.",
  status: "ACTIVE",
  visibility: "PUBLIC",
  playerInviteCode: "TRASHPACK2026",
  gmInviteCode: "TRASHPACK-GM",
  badges: DEFAULT_BADGE_DEFINITIONS,
  rules,
  faqs,
  trainers: [
    trainer({
      id: "oubori",
      handle: "Oubori",
      realName: "Jason",
      avatarSpriteKey: "brendan",
      statusText: "Pushing toward Wattson — grinding Magikarp patience.",
      reviveUsed: false,
      mainSquadLocked: false,
      sortOrder: 1,
      earnedBadgeKeys: ["gym-1", "gym-2"],
      pokemon: [
        ...sampleMain({
          idPrefix: "oubori",
          entries: [
            {
              species: "Combusken",
              pokedexId: 256,
              types: ["Fire", "Fighting"],
              nickname: "Drumstick",
              level: 24,
              ability: "Blaze",
              nature: "Adamant",
              route: "Starter",
              item: "Oran Berry",
              moves: ["Double Kick", "Ember", "Peck", "Sand Attack"],
            },
            {
              species: "Mightyena",
              pokedexId: 262,
              types: ["Dark"],
              nickname: "Nightbus",
              level: 22,
              ability: "Intimidate",
              nature: "Jolly",
              route: "Route 101",
              moves: ["Bite", "Howl", "Sand Attack", "Tackle"],
            },
            {
              species: "Wingull",
              pokedexId: 278,
              types: ["Water", "Flying"],
              nickname: "Seagull Steve",
              level: 18,
              ability: "Keen Eye",
              nature: "Modest",
              route: "Route 103",
              moves: ["Wing Attack", "Water Gun", "Growl", "Supersonic"],
            },
          ],
        }),
        mon({
          id: "oubori-rip-0",
          slot: "GRAVEYARD",
          partyIndex: 0,
          nickname: "Ziggy",
          species: "Zigzagoon",
          pokedexId: 263,
          isShiny: false,
          types: ["Normal"],
          nature: "Hardy",
          level: 7,
          ability: "Pickup",
          catchRoute: "Route 101",
          heldItem: null,
          moves: ["Tackle", "Growl"],
          causeOfDeath: "Crit Tackle from a wild Poochyena. Gone too soon.",
        }),
      ],
    }),
    trainer({
      id: "chedda",
      handle: "Chedda",
      realName: "Chet",
      avatarSpriteKey: "may",
      statusText: "Badge 1 clear. Looking for a Water-type before Dewford.",
      reviveUsed: false,
      mainSquadLocked: false,
      sortOrder: 2,
      earnedBadgeKeys: ["gym-1"],
      pokemon: sampleMain({
        idPrefix: "chedda",
        entries: [
          {
            species: "Marshtomp",
            pokedexId: 259,
            types: ["Water", "Ground"],
            nickname: "Mudpie",
            level: 20,
            ability: "Torrent",
            nature: "Quiet",
            route: "Starter",
            moves: ["Mud Shot", "Water Gun", "Tackle", "Growl"],
          },
          {
            species: "Seedot",
            pokedexId: 273,
            types: ["Grass"],
            nickname: "Acorn",
            level: 14,
            ability: "Chlorophyll",
            nature: "Bold",
            route: "Route 102",
            moves: ["Bide", "Harden", "Growth", "Tackle"],
          },
        ],
      }),
    }),
    trainer({
      id: "coolriceb",
      handle: "CoolRiceB",
      realName: "Lily",
      avatarSpriteKey: "wally",
      statusText: "Still in Petalburg Woods. Bug catching goes hard.",
      reviveUsed: true,
      mainSquadLocked: false,
      sortOrder: 3,
      earnedBadgeKeys: [],
      pokemon: [
        ...sampleMain({
          idPrefix: "coolriceb",
          entries: [
            {
              species: "Grovyle",
              pokedexId: 253,
              types: ["Grass"],
              nickname: "Snappea",
              level: 16,
              ability: "Overgrow",
              nature: "Timid",
              route: "Starter",
              moves: ["Absorb", "Quick Attack", "Pursuit", "Leer"],
            },
            {
              species: "Wurmple",
              pokedexId: 265,
              types: ["Bug"],
              nickname: "Noodle",
              level: 5,
              ability: "Shield Dust",
              nature: "Docile",
              route: "Petalburg Woods",
              moves: ["Tackle", "String Shot"],
            },
          ],
        }),
        mon({
          id: "coolriceb-res-0",
          slot: "RESERVE",
          partyIndex: 0,
          nickname: "Pebble",
          species: "Geodude",
          pokedexId: 74,
          isShiny: false,
          types: ["Rock", "Ground"],
          nature: "Impish",
          level: 12,
          ability: "Rock Head",
          catchRoute: "Granite Cave",
          heldItem: "Everstone",
          moves: ["Tackle", "Defense Curl", "Rock Throw", "Mud Sport"],
          causeOfDeath: null,
        }),
      ],
    }),
    trainer({
      id: "jamjah",
      handle: "JamJah",
      realName: null,
      avatarSpriteKey: "steven",
      statusText: "Just started — nickname brainstorming in progress.",
      reviveUsed: false,
      mainSquadLocked: false,
      sortOrder: 4,
      earnedBadgeKeys: [],
      pokemon: sampleMain({
        idPrefix: "jamjah",
        entries: [
          {
            species: "Torchic",
            pokedexId: 255,
            types: ["Fire"],
            nickname: "Matchstick",
            level: 8,
            ability: "Blaze",
            nature: "Lonely",
            route: "Starter",
            moves: ["Scratch", "Growl", "Focus Energy", "Ember"],
          },
        ],
      }),
    }),
    trainer({
      id: "jawn",
      handle: "Jawn",
      realName: "John",
      avatarSpriteKey: "red",
      statusText: "Route 110 grind. Electric types making life interesting.",
      reviveUsed: false,
      mainSquadLocked: false,
      sortOrder: 5,
      earnedBadgeKeys: ["gym-1", "gym-2", "gym-3"],
      pokemon: [
        ...sampleMain({
          idPrefix: "jawn",
          entries: [
            {
              species: "Swampert",
              pokedexId: 260,
              types: ["Water", "Ground"],
              nickname: "Bog Boss",
              level: 32,
              ability: "Torrent",
              nature: "Adamant",
              route: "Starter",
              item: "Mystic Water",
              moves: ["Muddy Water", "Mud Shot", "Ice Beam", "Earthquake"],
            },
            {
              species: "Manectric",
              pokedexId: 310,
              types: ["Electric"],
              nickname: "Static",
              level: 30,
              ability: "Static",
              nature: "Timid",
              route: "Route 110",
              moves: ["Thunderbolt", "Quick Attack", "Bite", "Flash"],
            },
            {
              species: "Swellow",
              pokedexId: 277,
              types: ["Normal", "Flying"],
              nickname: "Courier",
              level: 28,
              ability: "Guts",
              nature: "Jolly",
              route: "Route 104",
              moves: ["Wing Attack", "Quick Attack", "Endeavor", "Double Team"],
            },
            {
              species: "Breloom",
              pokedexId: 286,
              types: ["Grass", "Fighting"],
              nickname: "Shroomba",
              level: 29,
              ability: "Effect Spore",
              nature: "Adamant",
              route: "Petalburg Woods",
              moves: ["Mach Punch", "Mega Drain", "Headbutt", "Leech Seed"],
            },
          ],
        }),
        mon({
          id: "jawn-rip-0",
          slot: "GRAVEYARD",
          partyIndex: 0,
          nickname: "Skitty",
          species: "Delcatty",
          pokedexId: 301,
          isShiny: false,
          types: ["Normal"],
          nature: "Bashful",
          level: 24,
          ability: "Cute Charm",
          catchRoute: "Route 116",
          heldItem: null,
          moves: ["Sing", "Double Slap", "Attract", "Assist"],
          causeOfDeath: "Surprise Stone Edge from a Sky Battle trainer.",
        }),
      ],
    }),
    trainer({
      id: "solgan",
      handle: "Solgan",
      realName: null,
      avatarSpriteKey: "leaf",
      statusText: "Catching up after a week offline. Mauville next.",
      reviveUsed: false,
      mainSquadLocked: false,
      sortOrder: 6,
      earnedBadgeKeys: ["gym-1", "gym-2"],
      pokemon: sampleMain({
        idPrefix: "solgan",
        entries: [
          {
            species: "Combusken",
            pokedexId: 256,
            types: ["Fire", "Fighting"],
            nickname: "Solar Kick",
            level: 23,
            ability: "Blaze",
            nature: "Naughty",
            route: "Starter",
            moves: ["Double Kick", "Flame Burst", "Peck", "Sand Attack"],
            shiny: true,
          },
          {
            species: "Lombre",
            pokedexId: 271,
            types: ["Water", "Grass"],
            nickname: "Pond Punk",
            level: 21,
            ability: "Rain Dish",
            nature: "Calm",
            route: "Route 114",
            moves: ["Absorb", "Bubble", "Nature Power", "Astonish"],
          },
        ],
      }),
    }),
  ],
};

export const CHALLENGES: SeedChallenge[] = [trashPack2026];
