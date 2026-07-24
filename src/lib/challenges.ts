import { cache } from "react";
import { CHALLENGES } from "@/data/trash-pack-2026";
import type {
  ActivityItem,
  Challenge,
  TrainerProfile,
} from "@/lib/challenge-types";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import {
  getDatabaseHealth,
  isSchemaMismatchError,
  isUnreachableDbError,
} from "@/lib/db-health";
import { mapDbChallenge } from "@/lib/mappers";

const challengeInclude = {
  badges: true,
  rules: true,
  faqs: true,
  trainers: {
    include: {
      badges: { include: { badge: true } },
      pokemon: true,
    },
  },
  activities: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    include: {
      trainer: { select: { handle: true } },
      reactions: { select: { emoji: true, userId: true } },
    },
  },
};

function seedAsChallenge(raw: (typeof CHALLENGES)[number]): Challenge {
  return {
    ...raw,
    source: "seed" as const,
    visibility: raw.visibility ?? "PUBLIC",
    trainers: raw.trainers.map((t) => ({
      ...t,
      userId: null,
    })),
    activities: [],
  };
}

function logDbFallback(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[challenges] ${context} failed; falling back to seed.`, message);
}

/** Seed is only for local demos without DATABASE_URL — never mask a broken prod DB. */
async function shouldUseSeedData(): Promise<boolean> {
  if (!isDatabaseConfigured()) return true;
  const health = await getDatabaseHealth();
  return health.ok && health.mode === "unconfigured";
}

export async function listChallenges(): Promise<Challenge[]> {
  const health = await getDatabaseHealth();
  // Layout shows MaintenanceScreen; avoid throwing during prerender/build.
  if (!health.ok) return [];

  if (health.mode === "database") {
    try {
      const rows = await getPrisma().challenge.findMany({
        include: challengeInclude,
        orderBy: [{ year: "desc" }, { name: "asc" }],
      });
      if (rows.length > 0) {
        return rows.map((row) => mapDbChallenge(row));
      }
      // Configured DB with zero seasons — empty list, not Ash demo.
      return [];
    } catch (error) {
      if (isSchemaMismatchError(error) || isUnreachableDbError(error)) {
        console.error("[challenges] listChallenges hard failure", error);
        return [];
      }
      logDbFallback("listChallenges", error);
    }
  }

  if (await shouldUseSeedData()) {
    return CHALLENGES.map(seedAsChallenge);
  }
  return [];
}

/** Request-deduped so layout + page can both call without double-fetching. */
export const getChallenge = cache(
  async (
    slug: string,
    viewerUserId?: string | null,
  ): Promise<Challenge | null> => {
    const health = await getDatabaseHealth();
    if (!health.ok) return null;

    if (health.mode === "database") {
      try {
        const row = await getPrisma().challenge.findUnique({
          where: { slug },
          include: challengeInclude,
        });
        if (row) return mapDbChallenge(row, viewerUserId);
        return null;
      } catch (error) {
        if (isSchemaMismatchError(error) || isUnreachableDbError(error)) {
          console.error(`[challenges] getChallenge(${slug}) hard failure`, error);
          return null;
        }
        logDbFallback(`getChallenge(${slug})`, error);
      }
    }

    if (await shouldUseSeedData()) {
      const seed = CHALLENGES.find((c) => c.slug === slug);
      return seed ? seedAsChallenge(seed) : null;
    }
    return null;
  },
);

export async function getTrainer(
  slug: string,
  trainerId: string,
): Promise<{ challenge: Challenge; trainer: TrainerProfile } | null> {
  const challenge = await getChallenge(slug);
  if (!challenge) return null;
  const trainer = challenge.trainers.find((t) => t.id === trainerId);
  if (!trainer) return null;
  return { challenge, trainer };
}

export async function getRecentActivity(slug: string): Promise<ActivityItem[]> {
  const challenge = await getChallenge(slug);
  return challenge?.activities ?? [];
}

/** Lean activity feed fetch for client polling (skips trainers/rules/etc.). */
export async function listChallengeActivities(
  slug: string,
  viewerUserId?: string | null,
): Promise<ActivityItem[]> {
  const health = await getDatabaseHealth();
  if (!health.ok) return [];

  if (health.mode === "database") {
    try {
      const prisma = getPrisma();
      const challenge = await prisma.challenge.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!challenge) return [];

      const rows = await prisma.activityEvent.findMany({
        where: { challengeId: challenge.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          trainer: { select: { handle: true } },
          reactions: { select: { emoji: true, userId: true } },
        },
      });

      return rows.map((a) => {
        const counts = new Map<
          string,
          { count: number; reactedByMe: boolean }
        >();
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
          trainerHandle: a.trainer?.handle ?? null,
          reactions: [...counts.entries()].map(([emoji, v]) => ({
            emoji,
            count: v.count,
            reactedByMe: v.reactedByMe,
          })),
        };
      });
    } catch (error) {
      // Soft-fail feed poll — empty is better than crashing the hub.
      console.error("[challenges] listChallengeActivities failed", error);
      return [];
    }
  }
  return getRecentActivity(slug);
}
