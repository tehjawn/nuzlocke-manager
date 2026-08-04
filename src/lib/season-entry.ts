import { getChallengeAccessFields } from "@/lib/challenges";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { playerSeasonEntryPath } from "@/lib/first-run";
import { getWelcomeReadAt } from "@/lib/notifications";
import { getAccessForChallenge } from "@/lib/permissions";

/**
 * Resolve the season entry path for a viewer (home CTA, etc.).
 * Spectators and misconfigured DBs land on the public league board.
 */
export async function resolvePlayerSeasonEntryPath(
  slug: string,
  userId: string | null | undefined,
): Promise<string> {
  if (!userId) {
    return playerSeasonEntryPath(slug, {
      signedIn: false,
      introCompleted: null,
      welcomeCompleted: false,
      hasProgress: false,
    });
  }

  if (!isDatabaseConfigured()) {
    return playerSeasonEntryPath(slug, {
      signedIn: true,
      introCompleted: null,
      welcomeCompleted: false,
      hasProgress: false,
    });
  }

  const challenge = await getChallengeAccessFields(slug);
  if (!challenge?.id || challenge.source !== "database") {
    return `/challenges/${slug}`;
  }

  const access = await getAccessForChallenge(challenge.id);
  const [welcomeReadAt, trainer] = await Promise.all([
    getWelcomeReadAt(userId),
    getPrisma().trainerProfile.findUnique({
      where: {
        challengeId_userId: { challengeId: challenge.id, userId },
      },
      select: {
        introCompletedAt: true,
        _count: {
          select: {
            pokemon: { where: { slot: "MAIN" } },
          },
        },
      },
    }),
  ]);

  return playerSeasonEntryPath(slug, {
    signedIn: true,
    isGm: Boolean(access?.isGm),
    introCompleted: trainer ? trainer.introCompletedAt != null : null,
    welcomeCompleted: welcomeReadAt != null,
    hasProgress: (trainer?._count.pokemon ?? 0) > 0,
  });
}
