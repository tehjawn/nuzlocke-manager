import { CHALLENGES } from "@/data/trash-pack-2026";
import type {
  ActivityItem,
  Challenge,
  TrainerProfile,
} from "@/lib/challenge-types";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
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

export async function getChallenge(
  slug: string,
  viewerUserId?: string | null,
): Promise<Challenge | null> {
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
}

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
