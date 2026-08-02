import { DEFAULT_CHALLENGE_SLUG } from "@/lib/constants-app";
import {
  encodeActivityHead,
  publishActivityHead,
} from "@/lib/activity-watermark";
import { getPrisma } from "@/lib/db";
import { allocateUniqueHandle } from "@/lib/handles";
import { ensureWelcomeNotification } from "@/lib/notifications";
import { createInitialActiveRunInTx } from "@/lib/trainer-runs";

async function uniqueHandle(
  challengeId: string,
  preferred: string,
): Promise<string> {
  const prisma = getPrisma();
  return allocateUniqueHandle(challengeId, preferred, async (handle) => {
    const taken = await prisma.trainerProfile.findUnique({
      where: { challengeId_handle: { challengeId, handle } },
    });
    return Boolean(taken);
  });
}

export type ProvisionResult =
  | {
      ok: true;
      challengeId: string;
      slug: string;
      trainerId: string;
      created: boolean;
      role: "PLAYER" | "GAME_MASTER" | "SPECTATOR";
    }
  | { ok: false; reason: "not_found" | "invite_required" | "no_user" };

/**
 * Ensure a Discord user is a PLAYER (or existing role) with a personal trainer board.
 * Trash Pack 2026 always auto-joins. Other INVITE seasons still need membership.
 */
export async function ensureTrainerForChallenge(input: {
  userId: string;
  slug: string;
  allowAutoJoin?: boolean;
}): Promise<ProvisionResult> {
  const prisma = getPrisma();

  // One round-trip short-circuit when membership + trainer already exist.
  const existing = await prisma.challenge.findUnique({
    where: { slug: input.slug },
    select: {
      id: true,
      slug: true,
      visibility: true,
      memberships: {
        where: { userId: input.userId },
        select: { role: true },
        take: 1,
      },
      trainers: {
        where: { userId: input.userId },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!existing) return { ok: false, reason: "not_found" };

  const membership = existing.memberships[0] ?? null;
  const trainer = existing.trainers[0] ?? null;
  const isDefaultLeague = existing.slug === DEFAULT_CHALLENGE_SLUG;

  if (membership && trainer) {
    // Welcome is ensured at Discord sign-in — not on every season enter.
    return {
      ok: true,
      challengeId: existing.id,
      slug: existing.slug,
      trainerId: trainer.id,
      created: false,
      role: membership.role,
    };
  }

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return { ok: false, reason: "no_user" };

  const autoJoin =
    input.allowAutoJoin !== false &&
    (isDefaultLeague ||
      existing.visibility === "PUBLIC" ||
      existing.visibility === "UNLISTED");

  if (!membership && !autoJoin) {
    return { ok: false, reason: "invite_required" };
  }

  if (!membership) {
    await prisma.challengeMembership.create({
      data: {
        challengeId: existing.id,
        userId: input.userId,
        role: "PLAYER",
      },
    });
    const joined = await prisma.activityEvent.create({
      data: {
        challengeId: existing.id,
        actorId: input.userId,
        type: "MEMBER_JOINED",
        message: `${user.displayName ?? user.name ?? "A trainer"} joined the season`,
      },
    });
    void publishActivityHead(
      existing.id,
      encodeActivityHead(joined.createdAt, joined.id),
    );
  }

  const role =
    membership?.role ??
    (
      await prisma.challengeMembership.findUniqueOrThrow({
        where: {
          challengeId_userId: {
            challengeId: existing.id,
            userId: input.userId,
          },
        },
      })
    ).role;

  if (trainer) {
    return {
      ok: true,
      challengeId: existing.id,
      slug: existing.slug,
      trainerId: trainer.id,
      created: false,
      role,
    };
  }

  const preferred =
    user.displayName?.trim() ||
    user.name?.trim() ||
    user.discordUsername?.trim() ||
    `Trainer-${user.discordId?.slice(-4) ?? "new"}`;
  const handle = await uniqueHandle(existing.id, preferred);
  const maxSort = await prisma.trainerProfile.aggregate({
    where: { challengeId: existing.id },
    _max: { sortOrder: true },
  });

  const createdTrainer = await prisma.trainerProfile.create({
    data: {
      challengeId: existing.id,
      userId: input.userId,
      handle,
      realName: null,
      avatarSpriteKey: "brendan",
      statusText: "New trainer",
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  await createInitialActiveRunInTx(prisma, createdTrainer.id);

  const badges = await prisma.badgeDefinition.findMany({
    where: { challengeId: existing.id },
  });
  if (badges.length > 0) {
    await prisma.badgeProgress.createMany({
      data: badges.map((b) => ({
        trainerId: createdTrainer.id,
        badgeId: b.id,
        earned: false,
      })),
    });
  }

  const claimed = await prisma.activityEvent.create({
    data: {
      challengeId: existing.id,
      actorId: input.userId,
      trainerId: createdTrainer.id,
      type: "TRAINER_CLAIMED",
      message: `${handle} got a trainer board`,
    },
  });
  void publishActivityHead(
    existing.id,
    encodeActivityHead(claimed.createdAt, claimed.id),
  );

  if (isDefaultLeague) {
    await ensureWelcomeNotification(input.userId);
  }

  return {
    ok: true,
    challengeId: existing.id,
    slug: existing.slug,
    trainerId: createdTrainer.id,
    created: true,
    role,
  };
}

/** Always join Trash Pack 2026 for now. */
export async function provisionForDefaultLeague(userId: string) {
  return ensureTrainerForChallenge({
    userId,
    slug: DEFAULT_CHALLENGE_SLUG,
    allowAutoJoin: true,
  });
}
