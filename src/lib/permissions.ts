import { cache } from "react";
import { auth } from "@/auth";
import type { MembershipRole } from "@/lib/challenge-types";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { readGmLensOn } from "@/lib/gm-lens.server";

export type AccessContext = {
  userId: string;
  role: MembershipRole | null;
  isGm: boolean;
  isPlayer: boolean;
  ownsTrainer: (trainerUserId: string | null) => boolean;
  canEditTrainer: (trainerUserId: string | null) => boolean;
};

export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Sign in required");
  }
  if (!isDatabaseConfigured()) {
    throw new Error("Database is not configured");
  }
  return userId;
}

export async function getMembership(
  challengeId: string,
  userId: string,
): Promise<MembershipRole | null> {
  const membership = await getPrisma().challengeMembership.findUnique({
    where: {
      challengeId_userId: { challengeId, userId },
    },
  });
  return membership?.role ?? null;
}

/** Request-deduped — layout + page often both need access. */
export const getAccessForChallenge = cache(
  async (challengeId: string): Promise<AccessContext | null> => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId || !isDatabaseConfigured()) return null;

    const role = await getMembership(challengeId, userId);
    const isGm = role === "GAME_MASTER";
    const isPlayer = role === "PLAYER" || isGm;

    return {
      userId,
      role,
      isGm,
      isPlayer,
      ownsTrainer: (trainerUserId) => trainerUserId === userId,
      canEditTrainer: (trainerUserId) =>
        isGm || (role === "PLAYER" && trainerUserId === userId),
    };
  },
);

export async function requireTrainerEditAccess(trainerId: string) {
  const userId = await requireUserId();
  const trainer = await getPrisma().trainerProfile.findUnique({
    where: { id: trainerId },
    include: { challenge: true },
  });
  if (!trainer) throw new Error("Trainer not found");

  if (trainer.challenge.status === "ARCHIVED") {
    throw new Error("This season is archived and read-only");
  }

  const access = await getAccessForChallenge(trainer.challengeId);
  if (!access?.canEditTrainer(trainer.userId)) {
    throw new Error("You cannot edit this trainer board");
  }
  // Competing GMs stay on a player view unless they opt in.
  if (
    access.isGm &&
    !access.ownsTrainer(trainer.userId) &&
    !(await readGmLensOn(trainer.challenge.slug))
  ) {
    throw new Error("Turn on GM view to edit another trainer's board");
  }
  if (trainer.mainSquadLocked && !access.isGm) {
    // still allow reserves/graveyard/status? Plan says Main Squad locks — block MAIN edits in actions.
  }
  return { userId, trainer, access };
}

export async function requireGm(challengeId: string) {
  const userId = await requireUserId();
  const access = await getAccessForChallenge(challengeId);
  if (!access?.isGm) throw new Error("Game Master access required");
  return { userId, access };
}

/**
 * Whether the signed-in user is GM for a season slug. Request-time (auth + DB)
 * — only call from a Suspense-wrapped server component such as SiteHeaderSession.
 */
export const isGmForChallengeSlug = cache(
  async (slug: string | null | undefined): Promise<boolean> => {
    if (!slug || !isDatabaseConfigured()) return false;
    const challenge = await getPrisma().challenge.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!challenge) return false;
    const access = await getAccessForChallenge(challenge.id);
    return Boolean(access?.isGm);
  },
);
