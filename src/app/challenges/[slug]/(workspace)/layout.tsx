import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChallengeShell } from "@/components/ChallengeShell";
import {
  SeasonJumpRegistrar,
  challengeToJumpSeasonContext,
} from "@/features/jump";
import { canViewChallenge } from "@/lib/challenge-access";
import { getChallengeShell } from "@/lib/challenges";
import { isFirstRunChrome } from "@/lib/first-run";
import { getWelcomeReadAt } from "@/lib/notifications";
import { getAccessForChallenge } from "@/lib/permissions";


type LayoutProps = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

/**
 * Shared season chrome (header, info, tabs, feed).
 * Soft-navigating between season tabs keeps this layout mounted — only the
 * right-pane page segment swaps.
 */
export default async function SeasonWorkspaceLayout({
  children,
  params,
}: LayoutProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallengeShell(slug, session?.user?.id);
  if (!challenge) notFound();

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;

  if (
    !canViewChallenge({
      visibility: challenge.visibility,
      source: challenge.source,
      hasMembership: Boolean(access?.role),
    })
  ) {
    redirect(`/challenges/${slug}/join`);
  }

  const myTrainer = session?.user?.id
    ? challenge.trainers.find((trainer) => trainer.userId === session.user.id) ??
      null
    : null;
  const myTrainerId = myTrainer?.id ?? null;

  if (
    session?.user?.id &&
    challenge.source === "database" &&
    !myTrainerId
  ) {
    redirect(`/challenges/${slug}/me`);
  }

  const showGm = Boolean(access?.isGm);
  const welcomeReadAt = session?.user?.id
    ? await getWelcomeReadAt(session.user.id)
    : null;
  const firstRun = isFirstRunChrome({
    signedIn: Boolean(session?.user),
    welcomeCompleted: welcomeReadAt != null,
    hasProgress: (myTrainer?.pokemon.length ?? 0) > 0,
    isGm: showGm,
  });

  return (
    <>
      <SeasonJumpRegistrar
        season={challengeToJumpSeasonContext(challenge, {
          showGm,
          myTrainerId,
          firstRun,
        })}
      />
      <ChallengeShell
        slug={challenge.slug}
        name={challenge.name}
        year={challenge.year}
        game={challenge.game}
        description={challenge.description}
        status={challenge.status}
        activities={challenge.activities ?? []}
        canReact={Boolean(session?.user?.id && challenge.source === "database")}
        showGm={showGm}
        myTrainerId={myTrainerId}
        signedIn={Boolean(session?.user)}
        firstRun={firstRun}
      >
        {children}
      </ChallengeShell>
    </>
  );
}
