/**
 * Cross-request cached challenge loaders (Next.js Cache Components).
 * Never read cookies/auth here — map viewer redaction after the cache hit.
 *
 * Do not catch Prisma errors inside `"use cache"` — a thrown error must not
 * become a cached `null` (seed/demo fallback) for the cache lifetime.
 */

import { cacheLife, cacheTag } from "next/cache";
import { CHALLENGES } from "@/data/trash-pack-2026";
import {
  parseSnapshotGraves,
  type BoardSnapshotTrigger,
} from "@/lib/board-snapshot";
import type { PokemonEntry, PokemonSlot } from "@/lib/challenge-types";
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
  };
}

/** League board cards: MAIN with full columns so details modal stays useful. */
function boardLeagueInclude() {
  return {
    ...challengeMetaInclude,
    trainers: boardMainPartyTrainers(pokemonFullSelect),
  };
}

/** Tools / bounty / planner: all slots, full columns (redacted per viewer). */
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
 * Workspace chrome: meta + MAIN summary for Search / myTrainerId.
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
 * Tools page: all Pokémon slots with full columns. The cache is viewer-blind
 * by design — `tools/page.tsx` redacts competitive fields per trainer after
 * the hit, so IVs/EVs never reach a client that isn't entitled to them.
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

export type SeasonMemorialRunRow = {
  id: string;
  trainerId: string;
  runNumber: number;
  status: "ACTIVE" | "CLOSED";
};

export type SeasonMemorialSnapshotRow = {
  id: string;
  trainerId: string;
  trigger: BoardSnapshotTrigger;
  createdAt: string;
  runId: string | null;
  wipeCount: number;
  graves: PokemonEntry[];
};

/** Snapshots parsed per cache miss — the newest N across the whole season. */
const SEASON_MEMORIAL_SNAPSHOT_LIMIT = 400;

/**
 * Season memorial: run ledger + graveyard-only snapshot projections, for the
 * cross-run R.I.P. merge. Payloads are parsed here so the cache holds the small
 * projection rather than every archived board.
 */
export async function fetchSeasonMemorialGraveRows(slug: string): Promise<{
  runs: SeasonMemorialRunRow[];
  snapshots: SeasonMemorialSnapshotRow[];
} | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`season:${slug}`, `season:${slug}:board`);
  if (!isDatabaseConfigured()) return null;
  const prisma = getPrisma();
  const challenge = await prisma.challenge.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!challenge) return null;

  const [runs, snapRows] = await Promise.all([
    prisma.trainerRun.findMany({
      where: { trainer: { challengeId: challenge.id } },
      orderBy: { runNumber: "asc" },
      select: { id: true, trainerId: true, runNumber: true, status: true },
    }),
    prisma.trainerBoardSnapshot.findMany({
      where: { challengeId: challenge.id },
      orderBy: { createdAt: "desc" },
      take: SEASON_MEMORIAL_SNAPSHOT_LIMIT,
      select: {
        id: true,
        trainerId: true,
        trigger: true,
        createdAt: true,
        runId: true,
        payload: true,
      },
    }),
  ]);

  const snapshots: SeasonMemorialSnapshotRow[] = [];
  for (const row of snapRows) {
    const parsed = parseSnapshotGraves(row.payload);
    if (!parsed) continue;
    snapshots.push({
      id: row.id,
      trainerId: row.trainerId,
      trigger: row.trigger as BoardSnapshotTrigger,
      createdAt: row.createdAt.toISOString(),
      runId: row.runId,
      wipeCount: parsed.wipeCount,
      graves: parsed.graves,
    });
  }

  return { runs, snapshots };
}

export async function fetchDefaultSearchBrief() {
  "use cache";
  cacheTag("seasons:index");
  if (!isDatabaseConfigured()) {
    cacheLife("hours");
    const seed =
      CHALLENGES.find((c) => c.status === "ACTIVE") ?? CHALLENGES[0] ?? null;
    return seed
      ? {
          slug: seed.slug,
          name: seed.name,
          year: seed.year,
          status: seed.status,
          game: seed.game,
        }
      : null;
  }
  try {
    const prisma = getPrisma();
    const active = await prisma.challenge.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { year: "desc" },
      select: { slug: true, name: true, year: true, status: true, game: true },
    });
    // Awaited, not returned as a promise: a rejection has to surface inside
    // this try, and inside the "use cache" boundary, to be contained at all.
    const brief =
      active ??
      (await prisma.challenge.findFirst({
        orderBy: { year: "desc" },
        select: {
          slug: true,
          name: true,
          year: true,
          status: true,
          game: true,
        },
      }));
    cacheLife("hours");
    return brief;
  } catch {
    // The database is configured but unreachable — an autosuspended Neon
    // compute cold-starting, a network blip, an incident. Callers already
    // handle null, so degrade instead of taking the whole render down.
    //
    // This has to be caught here rather than in getDefaultSearchChallenge:
    // a "use cache" function that rejects during prerender fails the build
    // regardless of what the caller does with the rejection.
    //
    // Cached for minutes rather than hours so the next request retries: a
    // build that ran during a blip must not pin "no season" for an hour.
    // Not "seconds" — profiles that expire under five minutes are treated as
    // dynamic holes and excluded from prerendering, and the root layout awaits
    // this outside any <Suspense>, so that would fail the build a second way.
    cacheLife("minutes");
    return null;
  }
}
