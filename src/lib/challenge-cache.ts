/**
 * Cross-request cached challenge loaders (Next.js Cache Components).
 * Never read cookies/auth here — map viewer redaction after the cache hit.
 *
 * Do not catch Prisma errors inside `"use cache"` — a thrown error must not
 * become a cached `null` (seed/demo fallback) for the cache lifetime.
 */

import { cacheLife, cacheTag } from "next/cache";
import { CHALLENGES } from "@/data/trash-pack-2026";
import type { PokemonSlot } from "@/lib/challenge-types";
import {
  activityPreviewInclude,
  challengeMetaInclude,
  pokemonFullSelect,
  pokemonSummarySelect,
  pokemonToolsSelect,
  trainerRelationInclude,
  type PokemonSlotFilter,
} from "@/lib/challenge-queries";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

function boardInclude(pokemonSlots?: PokemonSlotFilter[]) {
  return {
    ...challengeMetaInclude,
    trainers: {
      include: {
        ...trainerRelationInclude,
        pokemon: {
          ...(pokemonSlots?.length
            ? { where: { slot: { in: pokemonSlots } } }
            : {}),
          select: pokemonFullSelect,
          orderBy: [{ slot: "asc" as const }, { partyIndex: "asc" as const }],
        },
      },
    },
    activities: activityPreviewInclude,
  };
}

/** MAIN-only trainers; `select` chooses summary vs full competitive columns. */
function boardMainPartyTrainers(
  select: typeof pokemonSummarySelect | typeof pokemonFullSelect,
) {
  return {
    include: {
      ...trainerRelationInclude,
      pokemon: {
        where: { slot: "MAIN" as const },
        select,
        orderBy: { partyIndex: "asc" as const },
      },
    },
  };
}

function boardShellInclude() {
  return {
    ...challengeMetaInclude,
    trainers: boardMainPartyTrainers(pokemonSummarySelect),
    activities: activityPreviewInclude,
  };
}

/** League board cards: MAIN with full columns so details modal stays useful. */
function boardLeagueInclude() {
  return {
    ...challengeMetaInclude,
    trainers: boardMainPartyTrainers(pokemonFullSelect),
  };
}

/** Tools / bounty / planner: all slots + moves, no IV/EV/heldItem. */
function boardPokemonToolsInclude() {
  return {
    ...challengeMetaInclude,
    trainers: {
      include: {
        ...trainerRelationInclude,
        pokemon: {
          select: pokemonToolsSelect,
          orderBy: [{ slot: "asc" as const }, { partyIndex: "asc" as const }],
        },
      },
    },
  };
}

export async function fetchChallengeBoardRow(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`season:${slug}`, `season:${slug}:board`);
  if (!isDatabaseConfigured()) return null;
  return getPrisma().challenge.findUnique({
    where: { slug },
    include: boardInclude(),
  });
}

export async function fetchChallengeMetaRow(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`season:${slug}`, `season:${slug}:meta`);
  if (!isDatabaseConfigured()) return null;
  return getPrisma().challenge.findUnique({
    where: { slug },
    include: challengeMetaInclude,
  });
}

export async function fetchChallengeSlotRow(
  slug: string,
  slots: PokemonSlot[],
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`season:${slug}`, `season:${slug}:board`);
  if (!isDatabaseConfigured()) return null;
  const pokemonSlots = [...slots].sort() as PokemonSlotFilter[];
  return getPrisma().challenge.findUnique({
    where: { slug },
    include: boardInclude(pokemonSlots),
  });
}

/**
 * Workspace chrome: meta + activity preview + MAIN summary for Jump / myTrainerId.
 * Avoids shipping RESERVE / GRAVEYARD / ENCOUNTERED (+ competitive columns).
 */
export async function fetchChallengeShellRow(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`season:${slug}`, `season:${slug}:board`, `season:${slug}:meta`);
  if (!isDatabaseConfigured()) return null;
  return getPrisma().challenge.findUnique({
    where: { slug },
    include: boardShellInclude(),
  });
}

/**
 * Trainers league board: MAIN party (full columns for card details) + per-slot
 * counts. Drops RESERVE / GRAVEYARD / ENCOUNTERED payloads from the Flight tree.
 */
export async function fetchChallengeBoardSummaryRow(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`season:${slug}`, `season:${slug}:board`);
  if (!isDatabaseConfigured()) return null;
  const prisma = getPrisma();
  const row = await prisma.challenge.findUnique({
    where: { slug },
    include: boardLeagueInclude(),
  });
  if (!row) return null;
  const trainerIds = row.trainers.map((t) => t.id);
  const slotCounts =
    trainerIds.length === 0
      ? []
      : await prisma.pokemonEntry.groupBy({
          by: ["trainerId", "slot"],
          where: { trainerId: { in: trainerIds } },
          _count: { _all: true },
        });
  return { ...row, slotCounts };
}

/**
 * Tools page: all Pokémon slots with summary + moves (Pokédex tips), without
 * heldItem / nature / ability / IVs / EVs.
 */
export async function fetchChallengeToolsSummaryRow(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`season:${slug}`, `season:${slug}:board`);
  if (!isDatabaseConfigured()) return null;
  return getPrisma().challenge.findUnique({
    where: { slug },
    include: boardPokemonToolsInclude(),
  });
}

export async function fetchSeasonIndexRows() {
  "use cache";
  cacheLife("hours");
  cacheTag("seasons:index");
  if (!isDatabaseConfigured()) return null;
  const rows = await getPrisma().challenge.findMany({
    orderBy: [{ year: "desc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      year: true,
      game: true,
      status: true,
      visibility: true,
      _count: { select: { trainers: true } },
    },
  });
  return rows.length > 0 ? rows : null;
}

export async function fetchHomeCarouselRow(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`season:${slug}`, `season:${slug}:board`);
  if (!isDatabaseConfigured()) return null;
  return getPrisma().challenge.findUnique({
    where: { slug },
    include: {
      trainers: {
        include: {
          ...trainerRelationInclude,
          pokemon: {
            where: { slot: "MAIN" },
            select: pokemonSummarySelect,
            orderBy: { partyIndex: "asc" },
            take: 1,
          },
        },
      },
    },
  });
}

export async function fetchDefaultJumpBrief() {
  "use cache";
  cacheLife("hours");
  cacheTag("seasons:index");
  if (!isDatabaseConfigured()) {
    const seed =
      CHALLENGES.find((c) => c.status === "ACTIVE") ?? CHALLENGES[0] ?? null;
    return seed
      ? {
          slug: seed.slug,
          name: seed.name,
          year: seed.year,
          status: seed.status,
        }
      : null;
  }
  const prisma = getPrisma();
  const active = await prisma.challenge.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { year: "desc" },
    select: { slug: true, name: true, year: true, status: true },
  });
  if (active) return active;
  return prisma.challenge.findFirst({
    orderBy: { year: "desc" },
    select: { slug: true, name: true, year: true, status: true },
  });
}
