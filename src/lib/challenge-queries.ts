/**
 * Tools Pokémon column selects + deferred hydrate shapes (#367).
 *
 * SSR uses summary only. Grade inputs / moves / full competitive columns load
 * via `fetchToolsPokemonHydrateAction` when a tool that needs them mounts.
 */

import {
  HEADLINE_ACTIVITY_TYPES,
  HEADLINE_LIMIT,
} from "@/lib/activity-headlines";

export const pokemonSummarySelect = {
  id: true,
  slot: true,
  partyIndex: true,
  nickname: true,
  species: true,
  pokedexId: true,
  isShiny: true,
  types: true,
  level: true,
  catchRoute: true,
  causeOfDeath: true,
  diedOnRun: true,
  runId: true,
  updatedAt: true,
} as const;

/** Full columns for board / trainer edit surfaces. */
export const pokemonFullSelect = {
  ...pokemonSummarySelect,
  nature: true,
  ability: true,
  heldItem: true,
  moves: true,
  ivs: true,
  evs: true,
  friendship: true,
  personalityValue: true,
  otId: true,
  notes: true,
} as const;

/**
 * Season Stats: summary + IVs for server-side god-catch boards.
 * Drops moves / EVs / held item / nature / ability / friendship — the page
 * never renders those, and public Flight still redacts IVs after aggregates.
 */
export const pokemonSeasonStatsSelect = {
  ...pokemonSummarySelect,
  ivs: true,
} as const;

/**
 * Encounters ledger: identity + catchRoute only. All slots, no competitive
 * columns — the route map never opens a details modal.
 */
export const pokemonEncounterSelect = pokemonSummarySelect;

/**
 * Tools SSR board (#367): identity + types + slots only. Catch/bond grades and
 * moves hydrate after mount for tools that need them.
 */
export const pokemonToolsBoardSelect = pokemonSummarySelect;

/**
 * Ownership Showcase hydrate: grade inputs so the server can stamp public
 * catch / bond tiers without shipping spreads on the default Tools Flight.
 */
export const pokemonToolsGradeSelect = {
  ...pokemonSummarySelect,
  nature: true,
  ability: true,
  ivs: true,
  evs: true,
  friendship: true,
} as const;

/**
 * Pokédex tips / Guide gym prep / Team Planner coverage: moves + grade inputs
 * (planner recommend chrome). Spreads are still stripped for non-entitled
 * viewers at the action boundary.
 */
export const pokemonToolsMovesSelect = {
  ...pokemonToolsGradeSelect,
  moves: true,
} as const;

/**
 * Ownership details / entitled competitive view: full columns. Flight still
 * redacts via `toPublicPokemonEntry` for everyone else.
 */
export const pokemonToolsSelect = {
  ...pokemonFullSelect,
} as const;

export const trainerUserSelect = {
  discordUsername: true,
  displayName: true,
  name: true,
} as const;

export const trainerRelationInclude = {
  user: { select: trainerUserSelect },
  badges: { include: { badge: { select: { key: true } } } },
} as const;

/**
 * Board payload activity slice — headline allowlist only (#322).
 * Full feed loads via `listChallengeActivities` / `/activity`.
 */
export const activityPreviewInclude = {
  where: { type: { in: [...HEADLINE_ACTIVITY_TYPES] } },
  orderBy: { createdAt: "desc" as const },
  take: HEADLINE_LIMIT,
  include: {
    trainer: { select: { id: true, handle: true, avatarSpriteKey: true } },
    actor: { select: { image: true } },
    reactions: { select: { emoji: true, userId: true } },
  },
};

/** All three carry `sortOrder` and an index for it — order explicitly. */
export const challengeMetaInclude = {
  badges: { orderBy: { sortOrder: "asc" } },
  rules: { orderBy: { sortOrder: "asc" } },
  faqs: { orderBy: { sortOrder: "asc" } },
} as const;

export type PokemonSlotFilter =
  | "MAIN"
  | "RESERVE"
  | "GRAVEYARD"
  | "ENCOUNTERED";
