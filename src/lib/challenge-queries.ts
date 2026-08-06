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
 * Tools page: identity + moves for Pokédex tips / bounty / planner, plus the
 * competitive columns Pokémon Ownership's Showcase needs — catch tier is
 * IV-derived and training tier needs EVs / friendship, so both are
 * uncomputable without them.
 *
 * Flight weight is still bounded: `toPublicPokemonEntry` runs at the page
 * boundary, so the payload only carries spreads the viewer already owns (or has
 * the GM lens for). Everyone else's arrive nulled, with the catch / bond tiers
 * stamped on in their place.
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
