/**
 * Page-shaped Prisma projections for challenges — avoid the fat god-include
 * unless a route truly needs the full graph.
 */

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
} as const;

/**
 * Tools page: identity + moves for Pokédex tips / bounty / planner, plus the
 * competitive columns Pokémon Ownership's Showcase needs — catch tier is
 * IV/EV-derived, so a tier is uncomputable without them.
 *
 * Flight weight is still bounded: `redactTrainerCompetitiveDetails` runs at the
 * page boundary, so the payload only carries spreads the viewer already owns
 * (or has the GM lens for). Everyone else's arrive nulled, exactly as before.
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

export const activityPreviewInclude = {
  orderBy: { createdAt: "desc" as const },
  take: 20,
  include: {
    trainer: { select: { id: true, handle: true, avatarSpriteKey: true } },
    actor: { select: { image: true } },
    reactions: { select: { emoji: true, userId: true } },
  },
};

export const challengeMetaInclude = {
  badges: true,
  rules: true,
  faqs: true,
} as const;

export type PokemonSlotFilter =
  | "MAIN"
  | "RESERVE"
  | "GRAVEYARD"
  | "ENCOUNTERED";
