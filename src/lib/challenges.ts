import { cache } from "react";
import { CHALLENGES } from "@/data/trash-pack-2026";
import type {
  ActivityItem,
  Challenge,
  TrainerProfile,
} from "@/lib/challenge-types";
import {
  coalesceActivityItems,
} from "@/lib/activity-messages";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { mapDbChallenge, resolveActivityAvatarSrc } from "@/lib/mappers";

const PREVIEW_ACTIVITY_TAKE = 20;
const DEFAULT_ACTIVITY_PAGE_SIZE = 30;
const MAX_ACTIVITY_PAGE_SIZE = 50;

/** Opaque cursor for activity pagination (`createdAt|id`). */
function encodeActivityCursor(createdAt: Date, id: string): string {
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

const challengeInclude = {
  badges: true,
  rules: true,
  faqs: true,
  trainers: {
    include: {
      badges: { include: { badge: true } },
      pokemon: true,
      user: {
        select: {
          discordUsername: true,
          displayName: true,
          name: true,
        },
      },
    },
  },
  activities: {
    orderBy: { createdAt: "desc" as const },
    take: PREVIEW_ACTIVITY_TAKE,
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
      discordUsername: t.discordUsername ?? null,
      discordDisplayName: t.discordDisplayName ?? null,
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

/**
 * Active (else newest) season for omnipresent Jump on global pages.
 * Request-deduped; prefers ACTIVE to match the homepage league CTA.
 */
export const getDefaultJumpChallenge = cache(async (): Promise<Challenge | null> => {
  if (isDatabaseConfigured()) {
    try {
      const prisma = getPrisma();
      const active = await prisma.challenge.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { year: "desc" },
        select: { slug: true },
      });
      if (active) return getChallenge(active.slug);

      const newest = await prisma.challenge.findFirst({
        orderBy: { year: "desc" },
        select: { slug: true },
      });
      if (newest) return getChallenge(newest.slug);
    } catch {
      // fall through to seed
    }
  }

  const seed =
    CHALLENGES.find((c) => c.status === "ACTIVE") ?? CHALLENGES[0] ?? null;
  return seed ? seedAsChallenge(seed) : null;
});

export async function getRecentActivity(slug: string): Promise<ActivityItem[]> {
  const challenge = await getChallenge(slug);
  return coalesceActivityItems(challenge?.activities ?? []);
}

export type ActivityPage = {
  items: ActivityItem[];
  nextCursor: string | null;
};

type ActivityRow = {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
  trainer: { handle: string; avatarSpriteKey: string | null } | null;
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
      if (!challenge) return { items: [], nextCursor: null };

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
          trainer: { select: { handle: true, avatarSpriteKey: true } },
          actor: { select: { image: true } },
          reactions: { select: { emoji: true, userId: true } },
        },
      });

      const pageRows = rows.slice(0, limit);
      const hasMore = rows.length > limit;
      const last = pageRows[pageRows.length - 1];
      const items = coalesceActivityItems(
        mapActivityRows(pageRows, viewerUserId),
      );

      return {
        items,
        nextCursor:
          hasMore && last
            ? encodeActivityCursor(last.createdAt, last.id)
            : null,
      };
    } catch {
      // fall through
    }
  }

  const seedItems = await getRecentActivity(slug);
  return { items: seedItems, nextCursor: null };
}
