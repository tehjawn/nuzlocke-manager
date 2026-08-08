import { cache } from "react";
import { CHALLENGES } from "@/data/trash-pack-2026";
import type {
  ActivityItem,
  ActivityPage,
  Challenge,
  PokemonSlot,
  TrainerProfile,
} from "@/lib/challenge-types";

import {
  fetchChallengeBoardRow,
  fetchChallengeBoardSummaryRow,
  fetchChallengeEncountersRow,
  fetchChallengeMetaRow,
  fetchChallengeSeasonStatsRow,
  fetchChallengeShellRow,
  fetchChallengeSlotRow,
  fetchChallengeToolsSummaryRow,
  fetchChallengeTournamentRow,
  fetchChallengeTrainerRow,
  fetchDefaultSearchBrief,
  fetchHeadlineActivitiesPublic,
  fetchHomeCarouselRow,
  fetchSeasonIndexRows,
  fetchSeasonMemorialGraveRows,
} from "@/lib/challenge-cache";
import {
  crossRunGraves,
  type CrossRunGravesResult,
  type MemorialBackfillRun,
  type MemorialBackfillSnapshot,
} from "@/lib/memorial-backfill";
import { currentRunNumber } from "@/lib/wipe-memorial";
import { pokemonInSlot } from "@/lib/trainer-display";
import {
  HEADLINE_LIMIT,
  headlineBlurb,
  isHeadlineActivityType,
  selectHeadlineItems,
  type HeadlineItem,
} from "@/lib/activity-headlines";
import { coalesceActivityItems } from "@/lib/activity-messages";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { mapDbChallenge, resolveActivityAvatarSrc } from "@/lib/mappers";
import { loadSurvivalPollTallies } from "@/lib/survival-markets";

export type { ActivityPage };

const DEFAULT_ACTIVITY_PAGE_SIZE = 30;
const MAX_ACTIVITY_PAGE_SIZE = 50;

/** Opaque cursor for activity pagination (`createdAt|id`). */
export function encodeActivityCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString(
    "base64url",
  );
}

function decodeActivityCursor(
  cursor: string,
): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const sep = raw.indexOf("|");
    if (sep <= 0) return null;
    const createdAt = new Date(raw.slice(0, sep));
    const id = raw.slice(sep + 1);
    if (!id || Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function seedAsChallenge(raw: (typeof CHALLENGES)[number]): Challenge {
  return {
    ...raw,
    source: "seed" as const,
    visibility: raw.visibility ?? "PUBLIC",
    survivalMarketsEnabled: raw.survivalMarketsEnabled ?? true,
    // Match mapDbChallenge — invite codes never ride public payloads.
    playerInviteCode: null,
    gmInviteCode: null,
    trainers: raw.trainers.map((t) => ({
      ...t,
      userId: null,
      discordUsername: t.discordUsername ?? null,
      discordDisplayName: t.discordDisplayName ?? null,
    })),
    activities: [],
  };
}

/** Side-load Survive/Die tallies after cached board fetch (viewer-aware). */
async function withSurvivalPollTallies(
  challenge: Challenge,
  viewerUserId?: string | null,
): Promise<Challenge> {
  if (!challenge.survivalMarketsEnabled || !isDatabaseConfigured()) {
    return challenge;
  }
  const pokemonIds = challenge.trainers.flatMap((t) =>
    t.pokemon.map((p) => p.id),
  );
  if (pokemonIds.length === 0) return challenge;
  try {
    const tallies = await loadSurvivalPollTallies(
      challenge.slug,
      pokemonIds,
      viewerUserId,
    );
    if (tallies.size === 0) return challenge;
    return {
      ...challenge,
      trainers: challenge.trainers.map((t) => ({
        ...t,
        pokemon: t.pokemon.map((p) => ({
          ...p,
          survivalPoll: tallies.get(p.id) ?? null,
        })),
      })),
    };
  } catch {
    return challenge;
  }
}

/**
 * Full season board. Cross-request Data Cache via fetchChallengeBoardRow;
 * viewer redaction applied in-process so metadata + page share one row shape.
 */
export async function getChallenge(
  slug: string,
  viewerUserId?: string | null,
): Promise<Challenge | null> {
  if (isDatabaseConfigured()) {
    try {
      const row = await fetchChallengeBoardRow(slug);
      if (row) {
        return withSurvivalPollTallies(
          mapDbChallenge(row, viewerUserId),
          viewerUserId,
        );
      }
    } catch {
      // Outage — don't fall through to seed (would look like a missing season).
      return null;
    }
  }
  const seed = CHALLENGES.find((c) => c.slug === slug);
  return seed ? seedAsChallenge(seed) : null;
}

/** Rules / about / join — no Pokémon rows. */
export async function getChallengeMeta(
  slug: string,
  viewerUserId?: string | null,
): Promise<Challenge | null> {
  if (isDatabaseConfigured()) {
    try {
      const row = await fetchChallengeMetaRow(slug);
      if (row) {
        return mapDbChallenge(
          {
            ...row,
            trainers: [],
            activities: [],
          },
          viewerUserId,
        );
      }
    } catch {
      return null;
    }
  }
  const seed = CHALLENGES.find((c) => c.slug === slug);
  if (!seed) return null;
  const full = seedAsChallenge(seed);
  return { ...full, trainers: [], activities: [] };
}

/** Memorial / encounters — slot-filtered Pokémon only. */
export async function getChallengeWithPokemonSlots(
  slug: string,
  slots: PokemonSlot[],
  viewerUserId?: string | null,
): Promise<Challenge | null> {
  if (isDatabaseConfigured()) {
    try {
      const row = await fetchChallengeSlotRow(slug, slots);
      if (row) {
        return withSurvivalPollTallies(
          mapDbChallenge(row, viewerUserId),
          viewerUserId,
        );
      }
    } catch {
      return null;
    }
  }
  const seed = CHALLENGES.find((c) => c.slug === slug);
  if (!seed) return null;
  const full = seedAsChallenge(seed);
  const slotSet = new Set(slots);
  return {
    ...full,
    trainers: full.trainers.map((t) => ({
      ...t,
      pokemon: t.pokemon.filter((p) => slotSet.has(p.slot)),
    })),
  };
}

/**
 * Season Stats — all slots with summary + IVs for god-catch aggregates.
 * Skips survival-poll side-load and activity preview (page never shows either).
 */
export async function getChallengeSeasonStats(
  slug: string,
  viewerUserId?: string | null,
): Promise<Challenge | null> {
  if (isDatabaseConfigured()) {
    try {
      const row = await fetchChallengeSeasonStatsRow(slug);
      if (row) {
        return mapDbChallenge({ ...row, activities: [] }, viewerUserId);
      }
    } catch {
      return null;
    }
  }
  return getChallenge(slug, viewerUserId);
}

/**
 * Encounters ledger — all slots at summary columns (catchRoute / species).
 * No competitive fields; no survival polls.
 */
export async function getChallengeEncounters(
  slug: string,
  viewerUserId?: string | null,
): Promise<Challenge | null> {
  if (isDatabaseConfigured()) {
    try {
      const row = await fetchChallengeEncountersRow(slug);
      if (row) {
        return mapDbChallenge({ ...row, activities: [] }, viewerUserId);
      }
    } catch {
      return null;
    }
  }
  return getChallenge(slug, viewerUserId);
}

/**
 * Tournament — meta + trainer identities only (mainSquadLocked / handles).
 * Zero Pokémon rows.
 */
export async function getChallengeTournament(
  slug: string,
  viewerUserId?: string | null,
): Promise<Challenge | null> {
  if (isDatabaseConfigured()) {
    try {
      const row = await fetchChallengeTournamentRow(slug);
      if (row) {
        return mapDbChallenge(
          {
            ...row,
            trainers: row.trainers.map((t) => ({ ...t, pokemon: [] })),
            activities: [],
          },
          viewerUserId,
        );
      }
    } catch {
      return null;
    }
  }
  const seed = CHALLENGES.find((c) => c.slug === slug);
  if (!seed) return null;
  const full = seedAsChallenge(seed);
  return {
    ...full,
    trainers: full.trainers.map((t) => ({ ...t, pokemon: [] })),
    activities: [],
  };
}

/**
 * Season memorial: every trainer's graves across every run.
 *
 * Live `GRAVEYARD` rows only ever cover the active run (a wipe empties the
 * board), so graves from closed runs are recovered read-only from the board
 * snapshot captured just before each wipe. Falls back to live-only when the
 * season has no snapshots (seed data, or history cleared).
 */
export async function getSeasonMemorialGraves(
  slug: string,
  trainers: TrainerProfile[],
): Promise<Record<string, CrossRunGravesResult>> {
  let rows: Awaited<ReturnType<typeof fetchSeasonMemorialGraveRows>> = null;
  if (isDatabaseConfigured()) {
    try {
      rows = await fetchSeasonMemorialGraveRows(slug);
    } catch {
      rows = null;
    }
  }

  const runsByTrainer = new Map<string, MemorialBackfillRun[]>();
  for (const run of rows?.runs ?? []) {
    const bucket = runsByTrainer.get(run.trainerId);
    const entry = {
      id: run.id,
      runNumber: run.runNumber,
      status: run.status,
    };
    if (bucket) bucket.push(entry);
    else runsByTrainer.set(run.trainerId, [entry]);
  }

  const snapshotsByTrainer = new Map<string, MemorialBackfillSnapshot[]>();
  for (const snap of rows?.snapshots ?? []) {
    const entry = {
      id: snap.id,
      trigger: snap.trigger,
      createdAt: snap.createdAt,
      runId: snap.runId,
      wipeCount: snap.wipeCount,
      pokemon: snap.graves,
    };
    const bucket = snapshotsByTrainer.get(snap.trainerId);
    if (bucket) bucket.push(entry);
    else snapshotsByTrainer.set(snap.trainerId, [entry]);
  }

  const byTrainerId: Record<string, CrossRunGravesResult> = {};
  for (const trainer of trainers) {
    const activeRunNumber = currentRunNumber(trainer.wipeCount ?? 0);
    const runs = runsByTrainer.get(trainer.id) ?? [
      // No run ledger (seed / pre-migration): treat the board as run 1..N.
      { id: `${trainer.id}-active`, runNumber: activeRunNumber, status: "ACTIVE" as const },
    ];
    byTrainerId[trainer.id] = crossRunGraves({
      runs,
      snapshots: snapshotsByTrainer.get(trainer.id) ?? [],
      liveGraves: pokemonInSlot(trainer, "GRAVEYARD"),
      activeRunNumber,
    });
  }
  return byTrainerId;
}

/**
 * Workspace layout chrome — MAIN + GRAVEYARD summary (no box / encounters /
 * activity). Enough for Search, Jump Ask memorial questions, and myTrainerId.
 */
export async function getChallengeShell(
  slug: string,
  viewerUserId?: string | null,
): Promise<Challenge | null> {
  if (isDatabaseConfigured()) {
    try {
      const row = await fetchChallengeShellRow(slug);
      if (row) return mapDbChallenge(row, viewerUserId);
    } catch {
      return null;
    }
  }
  const seed = CHALLENGES.find((c) => c.slug === slug);
  if (!seed) return null;
  const full = seedAsChallenge(seed);
  return {
    ...full,
    trainers: full.trainers.map((t) => ({
      ...t,
      pokemon: t.pokemon.filter(
        (p) => p.slot === "MAIN" || p.slot === "GRAVEYARD",
      ),
    })),
  };
}

function emptySlotCounts() {
  return { main: 0, reserve: 0, graveyard: 0, encountered: 0 };
}

function slotCountsFromPokemon(
  pokemon: Array<{ slot: PokemonSlot }>,
): NonNullable<TrainerProfile["slotCounts"]> {
  const counts = emptySlotCounts();
  for (const p of pokemon) {
    if (p.slot === "MAIN") counts.main += 1;
    else if (p.slot === "RESERVE") counts.reserve += 1;
    else if (p.slot === "GRAVEYARD") counts.graveyard += 1;
    else if (p.slot === "ENCOUNTERED") counts.encountered += 1;
  }
  return counts;
}

/**
 * Trainers league board — MAIN party (full columns) + slot tallies for card
 * footers. Drops ENCOUNTERED / RESERVE / GRAVEYARD payloads from the Flight tree.
 */
export async function getChallengeBoardSummary(
  slug: string,
  viewerUserId?: string | null,
): Promise<Challenge | null> {
  if (isDatabaseConfigured()) {
    try {
      const row = await fetchChallengeBoardSummaryRow(slug);
      if (!row) return null;
      const mapped = mapDbChallenge(
        { ...row, activities: [] },
        viewerUserId,
      );
      const byTrainer = new Map<
        string,
        NonNullable<TrainerProfile["slotCounts"]>
      >();
      for (const entry of row.slotCounts) {
        const cur = byTrainer.get(entry.trainerId) ?? emptySlotCounts();
        const n = entry._count._all;
        if (entry.slot === "MAIN") cur.main = n;
        else if (entry.slot === "RESERVE") cur.reserve = n;
        else if (entry.slot === "GRAVEYARD") cur.graveyard = n;
        else if (entry.slot === "ENCOUNTERED") cur.encountered = n;
        byTrainer.set(entry.trainerId, cur);
      }
      return withSurvivalPollTallies(
        {
          ...mapped,
          trainers: mapped.trainers.map((t) => ({
            ...t,
            slotCounts: byTrainer.get(t.id) ?? {
              ...emptySlotCounts(),
              main: t.pokemon.length,
            },
          })),
        },
        viewerUserId,
      );
    } catch {
      return null;
    }
  }
  const seed = CHALLENGES.find((c) => c.slug === slug);
  if (!seed) return null;
  const full = seedAsChallenge(seed);
  return {
    ...full,
    trainers: full.trainers.map((t) => ({
      ...t,
      slotCounts: slotCountsFromPokemon(t.pokemon),
      pokemon: t.pokemon.filter((p) => p.slot === "MAIN"),
    })),
  };
}

/**
 * Tools summary — owned slots only (MAIN / RESERVE / GRAVEYARD). ENCOUNTERED
 * stubs load when Ownership tracker / Pokédex need “seen” status (#382). No
 * competitive spreads; panels hydrate grades / moves after mount (#367).
 */
export async function getChallengeToolsSummary(
  slug: string,
  viewerUserId?: string | null,
): Promise<Challenge | null> {
  if (isDatabaseConfigured()) {
    try {
      const row = await fetchChallengeToolsSummaryRow(slug);
      if (row) {
        return withSurvivalPollTallies(
          mapDbChallenge({ ...row, activities: [] }, viewerUserId),
          viewerUserId,
        );
      }
    } catch {
      return null;
    }
  }
  const full = await getChallenge(slug, viewerUserId);
  if (!full) return null;
  return {
    ...full,
    trainers: full.trainers.map((t) => ({
      ...t,
      pokemon: t.pokemon.filter((p) => p.slot !== "ENCOUNTERED"),
    })),
  };
}

/** Season list for home / index — zero Pokémon. */
export type SeasonIndexItem = Pick<
  Challenge,
  "slug" | "name" | "year" | "game" | "status" | "visibility" | "source"
> & { id?: string; trainerCount: number };

export async function listSeasonIndex(): Promise<SeasonIndexItem[]> {
  if (isDatabaseConfigured()) {
    try {
      const rows = await fetchSeasonIndexRows();
      if (rows) {
        return rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          year: row.year,
          game: row.game ?? "Unknown",
          status: row.status,
          visibility: row.visibility,
          source: "database" as const,
          trainerCount: row._count.trainers,
        }));
      }
    } catch {
      return [];
    }
  }
  return CHALLENGES.map((c) => ({
    slug: c.slug,
    name: c.name,
    year: c.year,
    game: c.game,
    status: c.status,
    visibility: c.visibility ?? "PUBLIC",
    source: "seed" as const,
    trainerCount: c.trainers.length,
  }));
}

/** Home carousel: one season, MAIN lead only, summary columns. */
export async function getHomeCarouselChallenge(
  slug: string,
): Promise<Challenge | null> {
  if (isDatabaseConfigured()) {
    try {
      const row = await fetchHomeCarouselRow(slug);
      if (row) {
        return mapDbChallenge({
          ...row,
          badges: [],
          rules: [],
          faqs: [],
          activities: [],
        });
      }
    } catch {
      return null;
    }
  }
  return getChallenge(slug);
}

/**
 * One trainer's board — Main Squad with full columns. Reserves / R.I.P. /
 * Encountered are deferred (counts via slotCounts); survival tallies cover the
 * Main ids on the wire; box/memorial chips attach on hydrate (#365 / #378).
 */
export async function getTrainer(
  slug: string,
  trainerId: string,
  viewerUserId?: string | null,
): Promise<{ challenge: Challenge; trainer: TrainerProfile } | null> {
  if (isDatabaseConfigured()) {
    try {
      const row = await fetchChallengeTrainerRow(slug, trainerId);
      if (row) {
        const trainerRow = row.trainers[0];
        if (!trainerRow || trainerRow.id !== trainerId) return null;
        const slotCountRows =
          "slotCounts" in row && Array.isArray(row.slotCounts)
            ? row.slotCounts
            : [];
        const ownedCatchRoutes =
          "ownedCatchRoutes" in row && Array.isArray(row.ownedCatchRoutes)
            ? (row.ownedCatchRoutes as string[])
            : [];
        const challenge = await withSurvivalPollTallies(
          mapDbChallenge({ ...row, activities: [] }, viewerUserId),
          viewerUserId,
        );
        const trainer = challenge.trainers.find((t) => t.id === trainerId);
        if (!trainer) return null;
        const counts = emptySlotCounts();
        for (const entry of slotCountRows) {
          const n = entry._count._all;
          if (entry.slot === "MAIN") counts.main = n;
          else if (entry.slot === "RESERVE") counts.reserve = n;
          else if (entry.slot === "GRAVEYARD") counts.graveyard = n;
          else if (entry.slot === "ENCOUNTERED") counts.encountered = n;
        }
        const withRoutes = {
          ...trainer,
          slotCounts: counts,
          ownedCatchRoutes,
        };
        return {
          challenge: {
            ...challenge,
            trainers: [withRoutes],
          },
          trainer: withRoutes,
        };
      }
    } catch {
      return null;
    }
  }
  const seed = CHALLENGES.find((c) => c.slug === slug);
  if (!seed) return null;
  const full = seedAsChallenge(seed);
  const trainer = full.trainers.find((t) => t.id === trainerId);
  if (!trainer) return null;
  const slotCounts = slotCountsFromPokemon(trainer.pokemon);
  // Seed mirrors DB SSR: Main only; box / memorial / Encountered hydrate on expand.
  const boardPokemon = trainer.pokemon.filter((p) => p.slot === "MAIN");
  const ownedCatchRoutes = [
    ...new Set(
      trainer.pokemon
        .filter(
          (p) =>
            (p.slot === "MAIN" ||
              p.slot === "RESERVE" ||
              p.slot === "GRAVEYARD") &&
            p.catchRoute?.trim(),
        )
        .map((p) => p.catchRoute!.trim()),
    ),
  ];
  const lean = { ...trainer, pokemon: boardPokemon, slotCounts, ownedCatchRoutes };
  return {
    challenge: { ...full, trainers: [lean], activities: [] },
    trainer: lean,
  };
}

export type SearchSeasonBrief = {
  id?: string;
  slug: string;
  name: string;
  year: number;
  status: Challenge["status"];
  game?: string | null;
};

/**
 * Active (else newest) season brief for root Search / header — no trainers,
 * no Pokémon. Season pages register the full Search index via SeasonSearchRegistrar.
 */
export const getDefaultSearchChallenge = cache(
  async (): Promise<SearchSeasonBrief | null> => {
    try {
      return await fetchDefaultSearchBrief();
    } catch {
      return null;
    }
  },
);

/** Lean access fields for activity poll — never the fat board. */
export async function getChallengeAccessFields(slug: string): Promise<{
  id: string;
  slug: string;
  visibility: Challenge["visibility"];
  source: Challenge["source"];
} | null> {
  if (isDatabaseConfigured()) {
    try {
      const row = await getPrisma().challenge.findUnique({
        where: { slug },
        select: { id: true, slug: true, visibility: true },
      });
      if (row) {
        return { ...row, source: "database" };
      }
    } catch {
      // fall through
    }
  }
  const seed = CHALLENGES.find((c) => c.slug === slug);
  return seed
    ? {
        id: seed.slug,
        slug: seed.slug,
        visibility: seed.visibility ?? "PUBLIC",
        source: "seed",
      }
    : null;
}

export async function getRecentActivity(slug: string): Promise<ActivityItem[]> {
  const challenge = await getChallenge(slug);
  return coalesceActivityItems(challenge?.activities ?? []);
}

/**
 * Latest high-signal Pack moments for the left-rail Headline Moments carousel.
 * Public row is `"use cache"` + `:board`; overlay `reactedByMe` after auth (#366).
 */
export async function listHeadlineActivities(
  slug: string,
  viewerUserId?: string | null,
  limit: number = HEADLINE_LIMIT,
): Promise<HeadlineItem[]> {
  const take = Math.min(Math.max(limit, 1), HEADLINE_LIMIT);

  if (isDatabaseConfigured()) {
    try {
      const cached = await fetchHeadlineActivitiesPublic(slug, take);
      if (cached) {
        if (!viewerUserId || cached.length === 0) return cached;
        return overlayHeadlineReactedByMe(cached, viewerUserId);
      }
    } catch {
      // fall through
    }
  }

  const seedItems = await getRecentActivity(slug);
  const mapped = seedItems
    .filter((item) => isHeadlineActivityType(item.type))
    .map((item) => toHeadlineItem(item));
  return selectHeadlineItems(mapped, take);
}

async function overlayHeadlineReactedByMe(
  items: HeadlineItem[],
  viewerUserId: string,
): Promise<HeadlineItem[]> {
  const rows = await getPrisma().activityReaction.findMany({
    where: {
      userId: viewerUserId,
      activityId: { in: items.map((i) => i.id) },
    },
    select: { activityId: true, emoji: true },
  });
  if (rows.length === 0) return items;

  const mine = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = mine.get(row.activityId) ?? new Set<string>();
    set.add(row.emoji);
    mine.set(row.activityId, set);
  }

  return items.map((item) => {
    const emojis = mine.get(item.id);
    if (!emojis) return item;
    return {
      ...item,
      reactions: item.reactions.map((r) => ({
        ...r,
        reactedByMe: emojis.has(r.emoji),
      })),
    };
  });
}

type ActivityRow = {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
  trainer: {
    id: string;
    handle: string;
    avatarSpriteKey: string | null;
  } | null;
  actor: { image: string | null } | null;
  reactions: Array<{ emoji: string; userId: string }>;
};

function mapActivityRows(
  rows: ActivityRow[],
  viewerUserId?: string | null,
): ActivityItem[] {
  return rows.map((a) => {
    const counts = new Map<string, { count: number; reactedByMe: boolean }>();
    for (const r of a.reactions) {
      const cur = counts.get(r.emoji) ?? {
        count: 0,
        reactedByMe: false,
      };
      cur.count += 1;
      if (viewerUserId && r.userId === viewerUserId) {
        cur.reactedByMe = true;
      }
      counts.set(r.emoji, cur);
    }
    return {
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
      reactions: [...counts.entries()].map(([emoji, v]) => ({
        emoji,
        count: v.count,
        reactedByMe: v.reactedByMe,
      })),
    };
  });
}

function toHeadlineItem(item: ActivityItem): HeadlineItem {
  return {
    ...item,
    avatarSpriteKey: null,
    cardBackgroundKey: null,
    avatarBackgroundKey: null,
    blurb: headlineBlurb(item),
  };
}

/** Lean activity feed fetch for client polling / infinite scroll. */
export async function listChallengeActivities(
  slug: string,
  viewerUserId?: string | null,
  opts?: { limit?: number; cursor?: string | null },
): Promise<ActivityPage> {
  const limit = Math.min(
    Math.max(opts?.limit ?? DEFAULT_ACTIVITY_PAGE_SIZE, 1),
    MAX_ACTIVITY_PAGE_SIZE,
  );
  const cursor = opts?.cursor ? decodeActivityCursor(opts.cursor) : null;

  if (isDatabaseConfigured()) {
    try {
      const prisma = getPrisma();
      const challenge = await prisma.challenge.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!challenge) return { items: [], nextCursor: null, head: null };

      const rows = await prisma.activityEvent.findMany({
        where: {
          challengeId: challenge.id,
          ...(cursor
            ? {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  {
                    AND: [
                      { createdAt: cursor.createdAt },
                      { id: { lt: cursor.id } },
                    ],
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        include: {
          trainer: { select: { id: true, handle: true, avatarSpriteKey: true } },
          actor: { select: { image: true } },
          reactions: { select: { emoji: true, userId: true } },
        },
      });

      const pageRows = rows.slice(0, limit);
      const hasMore = rows.length > limit;
      const last = pageRows[pageRows.length - 1];
      const first = pageRows[0];
      const items = coalesceActivityItems(
        mapActivityRows(pageRows, viewerUserId),
      );

      return {
        items,
        nextCursor:
          hasMore && last
            ? encodeActivityCursor(last.createdAt, last.id)
            : null,
        head: first ? encodeActivityCursor(first.createdAt, first.id) : null,
      };
    } catch {
      // fall through
    }
  }

  const seedItems = await getRecentActivity(slug);
  return {
    items: seedItems,
    nextCursor: null,
    head: seedItems[0]
      ? encodeActivityCursor(new Date(seedItems[0].createdAt), seedItems[0].id)
      : null,
  };
}
