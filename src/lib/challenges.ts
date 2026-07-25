import { cache } from "react";
import { CHALLENGES } from "@/data/trash-pack-2026";
import type {
  ActivityItem,
  Challenge,
  TrainerProfile,
} from "@/lib/challenge-types";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { mapDbChallenge, resolveActivityAvatarSrc } from "@/lib/mappers";

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
      trainer: { select: { handle: true, avatarSpriteKey: true } },
      actor: { select: { image: true } },
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

export async function listChallenges(): Promise<Challenge[]> {
  if (isDatabaseConfigured()) {
    try {
      const rows = await getPrisma().challenge.findMany({
        include: challengeInclude,
        orderBy: [{ year: "desc" }, { name: "asc" }],
      });
      if (rows.length > 0) {
        return rows.map((row) => mapDbChallenge(row));
      }
    } catch {
      // fall through to seed
    }
  }
  return CHALLENGES.map(seedAsChallenge);
}

/** Request-deduped so layout + page can both call without double-fetching. */
export const getChallenge = cache(
  async (
    slug: string,
    viewerUserId?: string | null,
  ): Promise<Challenge | null> => {
    if (isDatabaseConfigured()) {
      try {
        const row = await getPrisma().challenge.findUnique({
          where: { slug },
          include: challengeInclude,
        });
        if (row) return mapDbChallenge(row, viewerUserId);
      } catch {
        // fall through
      }
    }
    const seed = CHALLENGES.find((c) => c.slug === slug);
    return seed ? seedAsChallenge(seed) : null;
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
  if (isDatabaseConfigured()) {
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
          trainer: { select: { handle: true, avatarSpriteKey: true } },
          actor: { select: { image: true } },
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
    } catch {
      // fall through
    }
  }
  return getRecentActivity(slug);
}
