import type { PokemonType } from "@/lib/pokemon-types";

export type ChallengeStatus = "DRAFT" | "ACTIVE" | "TOURNAMENT" | "ARCHIVED";
export type ChallengeVisibility = "INVITE" | "UNLISTED" | "PUBLIC";
export type PokemonSlot = "MAIN" | "RESERVE" | "GRAVEYARD";
export type MembershipRole = "PLAYER" | "GAME_MASTER" | "SPECTATOR";
export type DataSource = "database" | "seed";

export type BadgeDefinition = {
  id?: string;
  key: string;
  label: string;
  category: "gym" | "elite" | "championship" | string;
  sortOrder: number;
  leaderName?: string | null;
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
  userId: string | null;
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

export type ActivityReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export type ActivityItem = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  trainerHandle: string | null;
  reactions: ActivityReactionSummary[];
};

export type Challenge = {
  id?: string;
  slug: string;
  name: string;
  year: number;
  game: string;
  description: string;
  status: ChallengeStatus;
  visibility: ChallengeVisibility;
  playerInviteCode?: string | null;
  gmInviteCode?: string | null;
  badges: BadgeDefinition[];
  rules: ChallengeRule[];
  faqs: FaqEntry[];
  trainers: TrainerProfile[];
  activities?: ActivityItem[];
  source: DataSource;
};
