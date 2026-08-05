import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getChallengeAccessFields } from "@/lib/challenges";
import { getPrisma } from "@/lib/db";
import {
  ensureTrainerForChallenge,
  revalidateProvisionedChallenge,
} from "@/lib/provision";

/**
 * Authenticated shortcut used by `/me` and `/trainers/me`: ensure a board
 * exists, then send unfinished intros to `/new-trainer` and everyone else to
 * their trainer board. Signed-out visitors bounce to `/login` with a callback.
 */
export async function redirectToOwnTrainerBoard(options: {
  slug: string;
  /** Same-origin relative path to return to after Discord login. */
  loginCallbackPath: string;
}): Promise<never> {
  const { slug, loginCallbackPath } = options;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(loginCallbackPath)}`,
    );
  }

  const challenge = await getChallengeAccessFields(slug);
  if (!challenge || challenge.source !== "database") {
    redirect("/challenges");
  }

  const result = await ensureTrainerForChallenge({
    userId: session.user.id,
    slug,
    allowAutoJoin: challenge.visibility !== "INVITE",
  });

  if (!result.ok) {
    redirect(
      result.reason === "invite_required"
        ? `/challenges/${slug}/join`
        : `/challenges/${slug}`,
    );
  }

  revalidateProvisionedChallenge(result.slug);

  const trainer = await getPrisma().trainerProfile.findUnique({
    where: { id: result.trainerId },
    select: { id: true, introCompletedAt: true },
  });

  if (trainer && !trainer.introCompletedAt) {
    redirect(`/challenges/${slug}/new-trainer`);
  }

  redirect(`/challenges/${slug}/trainers/${result.trainerId}`);
}
