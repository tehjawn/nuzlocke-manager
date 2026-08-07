/**
 * Cross-request cached challenge loaders (Next.js Cache Components).
 * Never read cookies/auth here — map viewer redaction after the cache hit.
 *
 * Do not catch Prisma errors inside `"use cache"` — a thrown error must not
 * become a cached `null` (seed/demo fallback) for the cache lifetime.
 *
 * Tag matrix + write-path helpers: `src/lib/revalidate-season.ts`.
 */

import { cacheLife, cacheTag } from "next/cache";
import { CHALLENGES } from "@/data/trash-pack-2026";
import {
  parseSnapshotGraves,
  type BoardSnapshotTrigger,
} from "@/lib/board-snapshot";
import {
  HEADLINE_ACTIVITY_TYPES,
  HEADLINE_CANDIDATE_LIMIT,
  HEADLINE_LIMIT,
  headlineBlurb,
  selectHeadlineItems,
  type HeadlineItem,
} from "@/lib/activity-headlines";
import type { PokemonEntry, PokemonSlot } from "@/lib/challenge-types";
import {
  activityPreviewInclude,
  challengeMetaInclude,
  pokemonEncounterSelect,
  pokemonFullSelect,
  pokemonSeasonStatsSelect,
  pokemonSummarySelect,
  pokemonToolsBoardSelect,
  trainerRelationInclude,
  type PokemonSlotFilter,
} from "@/lib/challenge-queries";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { resolveActivityAvatarSrc } from "@/lib/mappers";
import { parseAvatarBackgroundKey } from "@/data/avatar-backgrounds";
import { parseCardBackgroundKey } from "@/data/card-backgrounds";
import type {
  SurvivalMarketListItem,
  SurvivalMarketStatus,
} from "@/lib/survival-market-types";

type PokemonBoardSelect =
  | typeof pokemonSummarySelect
  | typeof pokemonSeasonStatsSelect
  | typeof pokemonFullSelect
  | typeof pokemonToolsBoardSelect;

function boardTrainers(
  select: PokemonBoardSelect,
  pokemonSlots?: PokemonSlotFilter[],
) {
  return {
    include: {
      ...trainerRelationInclude,
      pokemon: {
        ...(pokemonSlots?.length
          ? { where: { slot: { in: pokemonSlots } } }
          : {}),
        select,
        orderBy: [{ slot: "asc" as const }, { partyIndex: "asc" as const }],
      },
    },
  };
}

function boardInclude(pokemonSlots?: PokemonSlotFilter[]) {
  return {
    ...challengeMetaInclude,
    trainers: boardTrainers(pokemonFullSelect, pokemonSlots),
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

/**
 * Workspace Search / Jump Ask shell: living party + memorial.
 * GRAVEYARD is required so Ask can answer RIP / fallen questions without an
 * extra DB round-trip; RESERVE / ENCOUNTERED stay out to keep Flight light.
 */
function boardShellTrainers() {
  return {
    include: {
      ...trainerRelationInclude,
      pokemon: {
        where: { slot: { in: ["MAIN", "GRAVEYARD"] as PokemonSlot[] } },
        select: pokemonSummarySelect,
        orderBy: [
          { slot: "asc" as const },
          { partyIndex: "asc" as const },
        ],
      },
    },
  };
}

function boardShellInclude() {
  return {
    ...challengeMetaInclude,
    trainers: boardShellTrainers(),
  };
}

/** League board cards: MAIN with full columns so details modal stays useful. */
function boardLeagueInclude() {
  return {
    ...challengeMetaInclude,
    trainers: boardMainPartyTrainers(pokemonFullSelect),
  };
}

/**
 * Tools SSR: all slots at summary columns only (#367). Grades / moves /
 * competitive spreads hydrate client-side when a tool that needs them mounts.
 */
function boardPokemonToolsInclude() {
  return {
    ...challengeMetaInclude,
    trainers: boardTrainers(pokemonToolsBoardSelect),
  };
}

/** Season Stats: all slots, summary + IVs; no activity preview. */
function boardSeasonStatsInclude() {
  return {
    ...challengeMetaInclude,
    trainers: boardTrainers(pokemonSeasonStatsSelect),
  };
}

/** Encounters ledger: all slots, identity + catchRoute only. */
function boardEncountersInclude() {
  return {
    ...challengeMetaInclude,
    trainers: boardTrainers(pokemonEncounterSelect),
  };
}

/** Tournament: meta + trainer identities; zero Pokémon rows. */
function boardTournamentInclude() {
  return {
    ...challengeMetaInclude,
    trainers: { include: trainerRelationInclude },
  };
}

/** Live board slots on the trainer page — Encountered hydrates on expand (#365). */
const TRAINER_BOARD_SLOTS: PokemonSlot[] = ["MAIN", "RESERVE", "GRAVEYARD"];

/** One trainer board: Main / Reserves / R.I.P., no peers / activity / Encountered. */
function boardSingleTrainerInclude(trainerId: string) {
  return {
    ...challengeMetaInclude,
    trainers: {
      where: { id: trainerId },
      include: {
        ...trainerRelationInclude,
        pokemon: {
          where: { slot: { in: TRAINER_BOARD_SLOTS } },
          select: pokemonFullSelect,
          orderBy: [
            { slot: "asc" as const },
            { partyIndex: "asc" as const },
          ],
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

/** Public Survive/Die chip tallies — no per-voter rows (#366). */
export type CachedSurvivalPollTally = {
  pokemonId: string;
  marketId: string;
  status: SurvivalMarketStatus;
  survive: number;
  die: number;
  total: number;
};

/**
 * Season Survive/Die aggregates for board chips. Cached on `:board` so votes
 * invalidate with the rest of the board; overlay `myPrediction` after auth.
 */
export async function fetchSurvivalPollTalliesPublic(
  slug: string,
): Promise<CachedSurvivalPollTally[] | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`season:${slug}`, `season:${slug}:board`);
  if (!isDatabaseConfigured()) return null;
  const prisma = getPrisma();
  const challenge = await prisma.challenge.findUnique({
    where: { slug },
    select: { id: true, survivalMarketsEnabled: true },
  });
  if (!challenge?.survivalMarketsEnabled) return [];

  const markets = await prisma.survivalMarket.findMany({
    where: { challengeId: challenge.id, pokemonId: { not: null } },
    select: { id: true, pokemonId: true, status: true },
  });
  if (markets.length === 0) return [];

  const marketIds = markets.map((m) => m.id);
  const groups = await prisma.survivalVote.groupBy({
    by: ["marketId", "prediction"],
    where: { marketId: { in: marketIds } },
    _count: { _all: true },
  });

  const countsByMarket = new Map<
    string,
    { survive: number; die: number; total: number }
  >();
  for (const g of groups) {
    const cur = countsByMarket.get(g.marketId) ?? {
      survive: 0,
      die: 0,
      total: 0,
    };
    if (g.prediction === "SURVIVE") cur.survive += g._count._all;
    else cur.die += g._count._all;
    cur.total = cur.survive + cur.die;
    countsByMarket.set(g.marketId, cur);
  }

  const out: CachedSurvivalPollTally[] = [];
  for (const market of markets) {
    if (!market.pokemonId) continue;
    const counts = countsByMarket.get(market.id) ?? {
      survive: 0,
      die: 0,
      total: 0,
    };
    if (counts.total === 0 && market.status === "OPEN") continue;
    out.push({
      pokemonId: market.pokemonId,
      marketId: market.id,
      status: market.status,
      survive: counts.survive,
      die: counts.die,
      total: counts.total,
    });
  }
  return out;
}

/**
 * Tools Survive/Die board — slim public rows (groupBy counts + last comment).
 * Overlay `myPrediction` after auth (#366).
 */
export async function fetchSurvivalMarketsListPublic(
  slug: string,
): Promise<SurvivalMarketListItem[] | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`season:${slug}`, `season:${slug}:board`);
  if (!isDatabaseConfigured()) return null;
  const prisma = getPrisma();
  const challenge = await prisma.challenge.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!challenge) return [];

  const rows = await prisma.survivalMarket.findMany({
    where: {
      challengeId: challenge.id,
      status: { not: "VOID" },
    },
    select: {
      id: true,
      pokemonId: true,
      trainerId: true,
      status: true,
      species: true,
      nickname: true,
      pokedexId: true,
      isShiny: true,
      resolvedAt: true,
      updatedAt: true,
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  if (rows.length === 0) return [];

  const marketIds = rows.map((r) => r.id);
  const trainerIds = [...new Set(rows.map((r) => r.trainerId))];

  const [groups, commentRows, trainers] = await Promise.all([
    prisma.survivalVote.groupBy({
      by: ["marketId", "prediction"],
      where: { marketId: { in: marketIds } },
      _count: { _all: true },
    }),
    prisma.survivalVote.findMany({
      where: {
        marketId: { in: marketIds },
        comment: { not: null },
      },
      select: { marketId: true, comment: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.trainerProfile.findMany({
      where: { id: { in: trainerIds } },
      select: { id: true, handle: true },
    }),
  ]);

  const countsByMarket = new Map<
    string,
    { survive: number; die: number; total: number; survivePct: number }
  >();
  for (const g of groups) {
    const cur = countsByMarket.get(g.marketId) ?? {
      survive: 0,
      die: 0,
      total: 0,
      survivePct: 0,
    };
    if (g.prediction === "SURVIVE") cur.survive += g._count._all;
    else cur.die += g._count._all;
    cur.total = cur.survive + cur.die;
    cur.survivePct =
      cur.total === 0 ? 0 : Math.round((cur.survive / cur.total) * 100);
    countsByMarket.set(g.marketId, cur);
  }

  const lastCommentByMarket = new Map<string, string>();
  for (const row of commentRows) {
    if (lastCommentByMarket.has(row.marketId)) continue;
    const trimmed = row.comment?.trim();
    if (trimmed) lastCommentByMarket.set(row.marketId, trimmed);
  }

  const handleById = new Map(trainers.map((t) => [t.id, t.handle]));

  return rows.map((row) => {
    const counts = countsByMarket.get(row.id) ?? {
      survive: 0,
      die: 0,
      total: 0,
      survivePct: 0,
    };
    return {
      id: row.id,
      status: row.status,
      pokemonId: row.pokemonId,
      species: row.species,
      nickname: row.nickname,
      pokedexId: row.pokedexId,
      isShiny: row.isShiny,
      survive: counts.survive,
      die: counts.die,
      total: counts.total,
      survivePct: counts.survivePct,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      lastComment: lastCommentByMarket.get(row.id) ?? null,
      myPrediction: null,
      trainer: {
        id: row.trainerId,
        handle: handleById.get(row.trainerId) ?? "Trainer",
      },
    };
  });
}

/**
 * Headline Moments rail — public row with reaction aggregates only (#366).
 * Overlay `reactedByMe` after auth.
 */
export async function fetchHeadlineActivitiesPublic(
  slug: string,
  limit: number = HEADLINE_LIMIT,
): Promise<HeadlineItem[] | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`season:${slug}`, `season:${slug}:board`);
  if (!isDatabaseConfigured()) return null;
  const take = Math.min(Math.max(limit, 1), HEADLINE_LIMIT);
  const prisma = getPrisma();
  const challenge = await prisma.challenge.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!challenge) return [];

  const rows = await prisma.activityEvent.findMany({
    where: {
      challengeId: challenge.id,
      type: { in: [...HEADLINE_ACTIVITY_TYPES] },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: HEADLINE_CANDIDATE_LIMIT,
    select: {
      id: true,
      type: true,
      message: true,
      createdAt: true,
      trainer: {
        select: {
          id: true,
          handle: true,
          avatarSpriteKey: true,
          cardBackgroundKey: true,
          avatarBackgroundKey: true,
        },
      },
      actor: { select: { image: true } },
    },
  });
  if (rows.length === 0) return [];

  const activityIds = rows.map((r) => r.id);
  const reactionGroups = await prisma.activityReaction.groupBy({
    by: ["activityId", "emoji"],
    where: { activityId: { in: activityIds } },
    _count: { _all: true },
  });
  const reactionsByActivity = new Map<
    string,
    Array<{ emoji: string; count: number; reactedByMe: boolean }>
  >();
  for (const g of reactionGroups) {
    const list = reactionsByActivity.get(g.activityId) ?? [];
    list.push({
      emoji: g.emoji,
      count: g._count._all,
      reactedByMe: false,
    });
    reactionsByActivity.set(g.activityId, list);
  }

  const mapped: HeadlineItem[] = rows.map((a) => {
    const base = {
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
      trainerId: a.trainer?.id ?? null,
      trainerHandle: a.trainer?.handle ?? null,
      avatarSrc: resolveActivityAvatarSrc({
        trainerAvatarSpriteKey: a.trainer?.avatarSpriteKey,
        actorImage: a.actor?.image,
      }),
      reactions: reactionsByActivity.get(a.id) ?? [],
    };
    return {
      ...base,
      avatarSpriteKey: a.trainer?.avatarSpriteKey ?? null,
      cardBackgroundKey: parseCardBackgroundKey(a.trainer?.cardBackgroundKey),
      avatarBackgroundKey: parseAvatarBackgroundKey(
        a.trainer?.avatarBackgroundKey,
      ),
      blurb: headlineBlurb(base),
    };
  });

  return selectHeadlineItems(mapped, take);
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
 * Workspace chrome: meta + MAIN + GRAVEYARD summary for Search / Jump Ask /
 * myTrainerId. Avoids RESERVE / ENCOUNTERED (+ competitive columns).
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
 * Tools page: shared summary board for every `?tool=` (and the hub). One cache
 * key — panels that need grades / moves / spreads call
 * `fetchToolsPokemonHydrateAction` after mount (#367).
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

/**
 * Season Stats — all slots with summary + IVs (god-catch aggregates). Drops
 * moves / EVs / held items and the activity preview the page never shows.
 */
export async function fetchChallengeSeasonStatsRow(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`season:${slug}`, `season:${slug}:board`);
  if (!isDatabaseConfigured()) return null;
  return getPrisma().challenge.findUnique({
    where: { slug },
    include: boardSeasonStatsInclude(),
  });
}

/**
 * Encounters — all slots at summary columns (catchRoute ledger). No
 * competitive fields and no activity preview.
 */
export async function fetchChallengeEncountersRow(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`season:${slug}`, `season:${slug}:board`);
  if (!isDatabaseConfigured()) return null;
  return getPrisma().challenge.findUnique({
    where: { slug },
    include: boardEncountersInclude(),
  });
}

/**
 * Tournament — challenge meta + trainer identities (mainSquadLocked). Zero
 * Pokémon rows; the bracket only needs handles and lock state.
 */
export async function fetchChallengeTournamentRow(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`season:${slug}`, `season:${slug}:board`, `season:${slug}:meta`);
  if (!isDatabaseConfigured()) return null;
  return getPrisma().challenge.findUnique({
    where: { slug },
    include: boardTournamentInclude(),
  });
}

/**
 * Single trainer board — meta + Main / Reserves / R.I.P. Peers, activity, and
 * Encountered stay out of the Flight payload; slot tallies keep footer counts
 * honest. Encountered rows hydrate when the section opens (#365).
 */
export async function fetchChallengeTrainerRow(
  slug: string,
  trainerId: string,
) {
  "use cache";
  cacheLife("minutes");
  // Per-trainer tag — party edits on peers must not cold-fetch this row (#379).
  // Keep root `season:${slug}` for GM/mass `revalidateChallenge`; omit `:board`.
  cacheTag(`season:${slug}`, `season:${slug}:trainer:${trainerId}`);
  if (!isDatabaseConfigured()) return null;
  const prisma = getPrisma();
  const row = await prisma.challenge.findUnique({
    where: { slug },
    include: boardSingleTrainerInclude(trainerId),
  });
  if (!row?.trainers[0]) return row;
  const slotCounts = await prisma.pokemonEntry.groupBy({
    by: ["slot"],
    where: { trainerId },
    _count: { _all: true },
  });
  return { ...row, slotCounts };
}

/**
 * Encountered buffer for one trainer — deferred from the trainer page SSR.
 */
export async function fetchTrainerEncounteredRow(
  slug: string,
  trainerId: string,
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`season:${slug}`, `season:${slug}:trainer:${trainerId}`);
  if (!isDatabaseConfigured()) return null;
  return getPrisma().pokemonEntry.findMany({
    where: {
      slot: "ENCOUNTERED",
      trainer: { id: trainerId, challenge: { slug } },
    },
    select: pokemonFullSelect,
    orderBy: { partyIndex: "asc" },
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
