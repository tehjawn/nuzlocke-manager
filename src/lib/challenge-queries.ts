/**
 * Page-shaped Prisma projections for challenges — avoid the fat god-include
 * unless a route truly needs the full graph.
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
 * Tools board shapes (#367) — pick by `?tool=` so the hub / Survive/Die /
 * ItemDex / Type Chart don't pay for competitive columns or moves.
 *
 * - `summary`: identity + types (markets, chart, ItemDex, hub)
 * - `moves`: + move lists for Pokédex tips / Game Guide gym prep
 * - `competitive`: full columns for Ownership Showcase grades + details and
 *   Team Planner coverage / catch chrome. Flight still redacts via
 *   `toPublicPokemonEntry` (stamped public grades, private spreads).
 */
export type ToolsPokemonShape = "summary" | "moves" | "competitive";

export const pokemonToolsMovesSelect = {
  ...pokemonSummarySelect,
  moves: true,
} as const;

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
