import { getPrisma } from "@/lib/db";

function sanitizeHandle(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 24);
  return cleaned || "Trainer";
}

async function uniqueHandle(
  challengeId: string,
  preferred: string,
): Promise<string> {
  const prisma = getPrisma();
  const base = sanitizeHandle(preferred);
  const existing = await prisma.trainerProfile.findUnique({
    where: { challengeId_handle: { challengeId, handle: base } },
  });
  if (!existing) return base;

  for (let i = 2; i < 100; i++) {
    const candidate = `${base.slice(0, 20)} ${i}`;
    const taken = await prisma.trainerProfile.findUnique({
      where: { challengeId_handle: { challengeId, handle: candidate } },
    });
    if (!taken) return candidate;
  }

  return `${base.slice(0, 16)}-${Date.now().toString(36).slice(-4)}`;
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
 * PUBLIC / UNLISTED seasons auto-join. INVITE seasons require prior membership.
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

  const autoJoin =
    input.allowAutoJoin !== false &&
    (challenge.visibility === "PUBLIC" || challenge.visibility === "UNLISTED");

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

  const preferred =
    user.displayName ?? user.name ?? `Trainer-${user.discordId?.slice(-4) ?? "new"}`;
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
      statusText: "Just joined — board ready to fill in.",
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  // Seed empty badge progress rows so the case is ready to toggle
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

  return {
    ok: true,
    challengeId: challenge.id,
    slug: challenge.slug,
    trainerId: trainer.id,
    created: true,
    role: membership.role,
  };
}

/** Auto-provision into every ACTIVE public/unlisted season (called after Discord login). */
export async function provisionForActiveSeasons(userId: string) {
  const prisma = getPrisma();
  const seasons = await prisma.challenge.findMany({
    where: {
      status: "ACTIVE",
      visibility: { in: ["PUBLIC", "UNLISTED"] },
    },
    select: { slug: true },
  });

  const results = [];
  for (const season of seasons) {
    results.push(
      await ensureTrainerForChallenge({
        userId,
        slug: season.slug,
        allowAutoJoin: true,
      }),
    );
  }
  return results;
}
