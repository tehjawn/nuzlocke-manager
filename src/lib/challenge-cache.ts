/**
 * Cross-request cached challenge loaders (Next.js Cache Components).
 * Never read cookies/auth here — map viewer redaction after the cache hit.
 */

import { cacheLife, cacheTag } from "next/cache";
import { CHALLENGES } from "@/data/trash-pack-2026";
import type { PokemonSlot } from "@/lib/challenge-types";
import {
  activityPreviewInclude,
  challengeMetaInclude,
  pokemonFullSelect,
  pokemonSummarySelect,
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

export async function fetchChallengeBoardRow(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`season:${slug}`, `season:${slug}:board`);
  if (!isDatabaseConfigured()) return null;
  try {
    return await getPrisma().challenge.findUnique({
      where: { slug },
      include: boardInclude(),
    });
  } catch {
    return null;
  }
}

export async function fetchChallengeMetaRow(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`season:${slug}`, `season:${slug}:meta`);
  if (!isDatabaseConfigured()) return null;
  try {
    return await getPrisma().challenge.findUnique({
      where: { slug },
      include: {
        ...challengeMetaInclude,
        trainers: {
          select: {
            id: true,
            handle: true,
            sortOrder: true,
            userId: true,
          },
        },
      },
    });
  } catch {
    return null;
  }
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
  try {
    return await getPrisma().challenge.findUnique({
      where: { slug },
      include: boardInclude(pokemonSlots),
    });
  } catch {
    return null;
  }
}

export async function fetchSeasonIndexRows() {
  "use cache";
  cacheLife("hours");
  cacheTag("seasons:index");
  if (!isDatabaseConfigured()) return null;
  try {
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
  } catch {
    return null;
  }
}

export async function fetchHomeCarouselRow(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`season:${slug}`, `season:${slug}:board`);
  if (!isDatabaseConfigured()) return null;
  try {
    return await getPrisma().challenge.findUnique({
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
  } catch {
    return null;
  }
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
  try {
    const prisma = getPrisma();
    const active = await prisma.challenge.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { year: "desc" },
      select: { slug: true, name: true, year: true, status: true },
    });
    if (active) return active;
    return await prisma.challenge.findFirst({
      orderBy: { year: "desc" },
      select: { slug: true, name: true, year: true, status: true },
    });
  } catch {
    return null;
  }
}
