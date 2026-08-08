import type { CatchTier } from "@/lib/iv-quality";
import type { PokemonType } from "@/lib/pokemon-types";
import type { StatSpread } from "@/lib/stats";
import type { SurvivalPollTally } from "@/lib/survival-market-types";
import type { TrainingTier } from "@/lib/training-quality";

export type ChallengeStatus = "DRAFT" | "ACTIVE" | "TOURNAMENT" | "ARCHIVED";
export type ChallengeVisibility = "INVITE" | "UNLISTED" | "PUBLIC";
export type PokemonSlot = "MAIN" | "RESERVE" | "GRAVEYARD" | "ENCOUNTERED";
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
  ivs: StatSpread | null;
  evs: StatSpread | null;
  /** Gen 3 growth friendship (0–255); null when unknown / not imported. */
  friendship: number | null;
  causeOfDeath: string | null;
  /** 1-based run attempt when memorialized; null when unknown (legacy graves). */
  diedOnRun: number | null;
  /** TrainerRun id when known (living = active run; graves = run of death). */
  runId: string | null;
  /** Survive/Die poll tally when votes exist (board chips / details). */
  survivalPoll?: SurvivalPollTally | null;
  /**
   * Catch / bond grades precomputed by `toPublicPokemonEntry` so they survive
   * redaction — the grades are public, the spreads behind them are not.
   * Absent on unredacted entries, which still carry the inputs and are graded
   * on demand. Always read these via `resolveCatchTier` / `resolveCatchScore`
   * / `resolveTrainingTier` rather than branching on them directly.
   */
  catchTier?: CatchTier | null;
  /** Rounded weighted catch score; public tip companion to catchTier. */
  catchScore?: number | null;
  trainingTier?: TrainingTier | null;
};

export type TrainerProfile = {
  id: string;
  handle: string;
  realName: string | null;
  avatarSpriteKey: string;
  /** Curated stage plate behind the avatar sprite; null = none. */
  avatarBackgroundKey: string | null;
  /** Curated league-board card chrome; null = default frame fill. */
  cardBackgroundKey: string | null;
  statusText: string | null;
  statusEmoji: string | null;
  reviveUsed: boolean;
  /** Modern Emerald Safari areas claimed in the imported Nuzlocke flagset. */
  safariZoneAreas?: string[];
  /** False means legacy Safari catches cannot be resolved by area yet. */
  safariZoneAreasReliable?: boolean;
  /** Spent NuzlockeEncounterFlags bit indices from the last reliable import. */
  nuzlockeEncounterBits?: number[];
  /** False means open-route views should not trust the bitset yet. */
  nuzlockeEncounterBitsReliable?: boolean;
  /** Times this trainer restarted their run this season (= closed run count). */
  wipeCount: number;
  /** 1-based living attempt; equals wipeCount + 1 when in sync. */
  activeRunNumber: number;
  /** Runs finished by beating the Championship this season. */
  completionCount: number;
  /** Run is over and the next one has not started — the board is the final team. */
  runEnded: boolean;
  /** Last imported Pokédollars; null when never imported / unknown. */
  money: number | null;
  /** Last imported Gen 3 playtime in whole seconds; null when never imported / unknown. */
  playTimeSeconds: number | null;
  mainSquadLocked: boolean;
  /**
   * Player finished /new-trainer. False = still in the intro funnel.
   * Undefined on seed boards, which have no intro funnel — treat as done.
   */
  introCompleted?: boolean;
  sortOrder: number;
  userId: string | null;
  /** Discord login username for @mentions (no leading @). */
  discordUsername: string | null;
  /** Discord global display name, when known. */
  discordDisplayName: string | null;
  earnedBadgeKeys: string[];
  pokemon: PokemonEntry[];
  /**
   * Optional slot tallies when `pokemon` is a slim slice (e.g. MAIN-only board
   * summary). Prefer these over scanning `pokemon` for non-loaded slots.
   */
  slotCounts?: {
    main: number;
    reserve: number;
    graveyard: number;
    encountered: number;
  };
  /** ISO timestamp of latest trainer or Pokémon change, when known. */
  updatedAt: string | null;
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
  /** Linked trainer board when the event has a trainer; null for system/GM-only. */
  trainerId: string | null;
  trainerHandle: string | null;
  /** Player avatar URL when a trainer/actor is linked; null → app mark. */
  avatarSrc: string | null;
  reactions: ActivityReactionSummary[];
};

export type ActivityPage = {
  items: ActivityItem[];
  nextCursor: string | null;
  /** Latest activity watermark for poll short-circuit. */
  head?: string | null;
  unchanged?: boolean;
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
  /** GM-only; omitted from public challenge payloads. */
  discordWebhookUrl?: string | null;
  /** Get Started welcome video URL. Null = env fallback. */
  welcomeVideoUrl?: string | null;
  /** When the welcome video becomes visible to everyone (ISO). Null = default 9pm Eastern. */
  welcomeVideoPublishAt?: string | null;
  /** Get Started ROM download URL. Null = built-in Trash Pack Drive link. */
  romUrl?: string | null;
  /** Survive/Die polls on living MAIN + RESERVE (default on). */
  survivalMarketsEnabled?: boolean;
  badges: BadgeDefinition[];
  rules: ChallengeRule[];
  faqs: FaqEntry[];
  trainers: TrainerProfile[];
  activities?: ActivityItem[];
  source: DataSource;
};

export type TournamentMatchView = {
  id: string;
  round: number;
  sortOrder: number;
  label: string | null;
  trainerAId: string | null;
  trainerBId: string | null;
  winnerId: string | null;
  notes: string | null;
  trainerAHandle: string | null;
  trainerBHandle: string | null;
  winnerHandle: string | null;
};

export type TournamentView = {
  id: string;
  name: string | null;
  status: string;
  matches: TournamentMatchView[];
};
