import type { PokemonType } from "@/lib/pokemon-types";

export type ChallengeStatus = "DRAFT" | "ACTIVE" | "TOURNAMENT" | "ARCHIVED";
export type ChallengeVisibility = "INVITE" | "UNLISTED" | "PUBLIC";
export type PokemonSlot = "MAIN" | "RESERVE" | "GRAVEYARD";

export type BadgeDefinition = {
  key: string;
  label: string;
  category: "gym" | "elite" | "championship";
  sortOrder: number;
  leaderName?: string;
};

export type PokemonEntry = {
  id: string;
  slot: PokemonSlot;
  partyIndex: number;
  nickname: string | null;
  species: string;
  pokedexId: number | null;
  isShiny: boolean;
  types: PokemonType[];
  nature: string | null;
  level: number | null;
  ability: string | null;
  catchRoute: string | null;
  heldItem: string | null;
  moves: string[];
  causeOfDeath: string | null;
};

export type TrainerProfile = {
  id: string;
  handle: string;
  realName: string | null;
  avatarSpriteKey: string;
  statusText: string | null;
  reviveUsed: boolean;
  mainSquadLocked: boolean;
  sortOrder: number;
  earnedBadgeKeys: string[];
  pokemon: PokemonEntry[];
};

export type ChallengeRule = {
  id: string;
  sortOrder: number;
  title: string | null;
  body: string;
  isCore: boolean;
};

export type FaqEntry = {
  id: string;
  sortOrder: number;
  question: string;
  answer: string;
};

export type Challenge = {
  slug: string;
  name: string;
  year: number;
  game: string;
  description: string;
  status: ChallengeStatus;
  visibility: ChallengeVisibility;
  badges: BadgeDefinition[];
  rules: ChallengeRule[];
  faqs: FaqEntry[];
  trainers: TrainerProfile[];
};
