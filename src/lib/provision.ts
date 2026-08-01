import { DEFAULT_CHALLENGE_SLUG } from "@/lib/constants-app";
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
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return { ok: false, reason: "no_user" };

  const challenge = await prisma.challenge.findUnique({
    where: { slug: input.slug },
  });
  if (!challenge) return { ok: false, reason: "not_found" };

  const existingMembership = await prisma.challengeMembership.findUnique({
    where: {
      challengeId_userId: {
        challengeId: challenge.id,
        userId: input.userId,
      },
    },
  });

  const isDefaultLeague = challenge.slug === DEFAULT_CHALLENGE_SLUG;
  const autoJoin =
    input.allowAutoJoin !== false &&
    (isDefaultLeague ||
      challenge.visibility === "PUBLIC" ||
      challenge.visibility === "UNLISTED");

  if (!existingMembership && !autoJoin) {
    return { ok: false, reason: "invite_required" };
  }

  if (!existingMembership) {
    await prisma.challengeMembership.create({
      data: {
        challengeId: challenge.id,
        userId: input.userId,
        role: "PLAYER",
      },
    });
    await prisma.activityEvent.create({
      data: {
        challengeId: challenge.id,
        actorId: input.userId,
        type: "MEMBER_JOINED",
        message: `${user.displayName ?? user.name ?? "A trainer"} joined the season`,
      },
    });
  }

  const membership =
    existingMembership ??
    (await prisma.challengeMembership.findUniqueOrThrow({
      where: {
        challengeId_userId: {
          challengeId: challenge.id,
          userId: input.userId,
        },
      },
    }));

  const existingTrainer = await prisma.trainerProfile.findFirst({
    where: { challengeId: challenge.id, userId: input.userId },
  });
  if (existingTrainer) {
    return {
      ok: true,
      challengeId: challenge.id,
      slug: challenge.slug,
      trainerId: existingTrainer.id,
      created: false,
      role: membership.role,
    };
  }

  // Prefer Discord display name, then @username — never a bare id slug.
  const preferred =
    user.displayName?.trim() ||
    user.name?.trim() ||
    user.discordUsername?.trim() ||
    `Trainer-${user.discordId?.slice(-4) ?? "new"}`;
  const handle = await uniqueHandle(challenge.id, preferred);
  const maxSort = await prisma.trainerProfile.aggregate({
    where: { challengeId: challenge.id },
    _max: { sortOrder: true },
  });

  const trainer = await prisma.trainerProfile.create({
    data: {
      challengeId: challenge.id,
      userId: input.userId,
      handle,
      realName: null,
      avatarSpriteKey: "brendan",
      statusText: "New trainer",
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  await createInitialActiveRunInTx(prisma, trainer.id);

  const badges = await prisma.badgeDefinition.findMany({
    where: { challengeId: challenge.id },
  });
  if (badges.length > 0) {
    await prisma.badgeProgress.createMany({
      data: badges.map((b) => ({
        trainerId: trainer.id,
        badgeId: b.id,
        earned: false,
      })),
    });
  }

  await prisma.activityEvent.create({
    data: {
      challengeId: challenge.id,
      actorId: input.userId,
      trainerId: trainer.id,
      type: "TRAINER_CLAIMED",
      message: `${handle} got a trainer board`,
    },
  });

  if (isDefaultLeague) {
    await ensureWelcomeNotification(input.userId);
  }

  return {
    ok: true,
    challengeId: challenge.id,
    slug: challenge.slug,
    trainerId: trainer.id,
    created: true,
    role: membership.role,
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
