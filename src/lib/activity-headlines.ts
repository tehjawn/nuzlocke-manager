/**
 * High-signal Pack moments for the left-rail Headline Moments carousel (#322).
 * Full feed stays on `/activity`; this allowlist + ranking keep the rail
 * exciting — champion beats a coalesced "earned N badges" digest.
 */

import type { ActivityItem } from "@/lib/challenge-types";

export const HEADLINE_ACTIVITY_TYPES = [
  "BADGE_EARNED",
  "RUN_COMPLETED",
  "WIPE",
  "RUN_STARTED",
  "MAIN_SQUAD_LOCKED",
] as const;

export type HeadlineActivityType = (typeof HEADLINE_ACTIVITY_TYPES)[number];

/** Max slides in the rail carousel. */
export const HEADLINE_LIMIT = 3;

/**
 * Pull a wider candidate window so ranking can promote a slightly older
 * champion over a newer badge-batch coalesce update.
 */
export const HEADLINE_CANDIDATE_LIMIT = 24;

const HEADLINE_SET = new Set<string>(HEADLINE_ACTIVITY_TYPES);

export function isHeadlineActivityType(
  type: string,
): type is HeadlineActivityType {
  return HEADLINE_SET.has(type);
}

/** Rail slide payload — ActivityItem + trainer card chrome + shouty blurb. */
export type HeadlineItem = ActivityItem & {
  avatarSpriteKey: string | null;
  cardBackgroundKey: string | null;
  avatarBackgroundKey: string | null;
  /** Short punchy line for the carousel (may differ from feed `message`). */
  blurb: string;
};

/** Higher = more “headline-worthy.” Badge digests score lower than named badges. */
export function headlineTypeWeight(type: string, message: string): number {
  switch (type) {
    case "RUN_COMPLETED":
      return 100;
    case "WIPE":
      return 90;
    case "MAIN_SQUAD_LOCKED":
      return 65;
    case "RUN_STARTED":
      return 55;
    case "BADGE_EARNED":
      return isBadgeDigestMessage(message) ? 35 : 70;
    default:
      return 0;
  }
}

/** Coalesced multi-badge lines like "Chedda earned 5 badges". */
export function isBadgeDigestMessage(message: string): boolean {
  return /\bearned\s+\d+\s+badges\b/i.test(message);
}

/**
 * Shouty carousel copy. Champion / wipe get a fixed punchline; badges keep
 * the feed wording with a bang.
 */
export function headlineBlurb(item: {
  type: string;
  message: string;
  trainerHandle: string | null;
}): string {
  const handle = item.trainerHandle?.trim() || "A trainer";
  switch (item.type) {
    case "RUN_COMPLETED":
      return `${handle} beat the Champion!`;
    case "WIPE":
      return `${handle} wiped!`;
    case "RUN_STARTED":
      return `${handle} started a new run!`;
    case "MAIN_SQUAD_LOCKED":
      return `${handle} locked their Main Squad!`;
    case "BADGE_EARNED": {
      const trimmed = item.message.trim();
      if (!trimmed) return `${handle} earned a badge!`;
      return /[!?]$/.test(trimmed) ? trimmed : `${trimmed}!`;
    }
    default: {
      const trimmed = item.message.trim();
      if (!trimmed) return "Big Pack moment!";
      return /[!?]$/.test(trimmed) ? trimmed : `${trimmed}!`;
    }
  }
}

type Rankable = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  trainerId: string | null;
};

/**
 * Rank + thin a candidate pool into the carousel:
 * 1. Type weight (champion ≫ badge digest), then newest
 * 2. Drop badge rows for a trainer who already has a champion clear in-pool
 * 3. One trainer per slide — no repeat faces while other trainers remain
 * 4. Diversify types — don't fill the reel with three wipes when badges /
 *    clears / locks exist (max one of each type while alternatives remain)
 * 5. Cap at `limit`, lead with the heaviest moment
 */
export function selectHeadlineItems<T extends Rankable>(
  candidates: T[],
  limit: number = HEADLINE_LIMIT,
): T[] {
  if (candidates.length === 0 || limit <= 0) return [];

  const champions = new Set(
    candidates
      .filter((c) => c.type === "RUN_COMPLETED" && c.trainerId)
      .map((c) => c.trainerId as string),
  );

  const ranked = [...candidates].sort((a, b) => compareHeadlineRank(a, b));

  const eligible = ranked.filter((item) => {
    if (
      item.type === "BADGE_EARNED" &&
      item.trainerId &&
      champions.has(item.trainerId)
    ) {
      return false;
    }
    return true;
  });

  const picked: T[] = [];
  const typeCounts = new Map<string, number>();
  const pickedTrainers = new Set<string>();
  const remaining = [...eligible];

  while (picked.length < limit && remaining.length > 0) {
    const idx = remaining.findIndex((item) =>
      canPickHeadline(item, typeCounts, pickedTrainers, remaining),
    );
    const takeAt = idx >= 0 ? idx : 0;
    const next = remaining.splice(takeAt, 1)[0]!;
    picked.push(next);
    typeCounts.set(next.type, (typeCounts.get(next.type) ?? 0) + 1);
    if (next.trainerId) pickedTrainers.add(next.trainerId);
  }

  // Lead with the greatest moment, not whatever happened to be newest.
  return picked.sort((a, b) => compareHeadlineRank(a, b));
}

function compareHeadlineRank(a: Rankable, b: Rankable): number {
  const wa = headlineTypeWeight(a.type, a.message);
  const wb = headlineTypeWeight(b.type, b.message);
  if (wb !== wa) return wb - wa;
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  if (tb !== ta) return tb - ta;
  return b.id.localeCompare(a.id);
}

function canPickHeadline(
  item: Rankable,
  typeCounts: Map<string, number>,
  pickedTrainers: Set<string>,
  remaining: Rankable[],
): boolean {
  if (
    item.trainerId &&
    pickedTrainers.has(item.trainerId) &&
    remaining.some(
      (r) => !r.trainerId || !pickedTrainers.has(r.trainerId),
    )
  ) {
    // Prefer a fresh trainer while one is still available.
    return false;
  }

  const count = typeCounts.get(item.type) ?? 0;
  if (count === 0) return true;
  // Already have this type — only take another if the pool is mono-type.
  return !remaining.some((r) => r.type !== item.type);
}
