import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChallengeShell } from "@/components/ChallengeShell";
import { canViewChallenge } from "@/lib/challenge-access";
import { getChallenge } from "@/lib/challenges";
import { getAccessForChallenge } from "@/lib/permissions";
import { ensureTrainerForChallenge } from "@/lib/provision";

export const dynamic = "force-dynamic";

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
  let challenge = await getChallenge(slug, session?.user?.id);
  if (!challenge) notFound();

  let myTrainerId: string | null = null;

  if (session?.user?.id && challenge.source === "database") {
    const provisioned = await ensureTrainerForChallenge({
      userId: session.user.id,
      slug: challenge.slug,
      allowAutoJoin: challenge.visibility !== "INVITE",
    });
    if (provisioned.ok) {
      myTrainerId = provisioned.trainerId;
      if (provisioned.created) {
        challenge =
          (await getChallenge(slug, session.user.id)) ?? challenge;
      }
    }
  }

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

  return (
    <ChallengeShell
      slug={challenge.slug}
      name={challenge.name}
      year={challenge.year}
      game={challenge.game}
      description={challenge.description}
      status={challenge.status}
      activities={challenge.activities ?? []}
      canReact={Boolean(session?.user?.id && challenge.source === "database")}
      showGm={Boolean(access?.isGm)}
      myTrainerId={myTrainerId}
      signedIn={Boolean(session?.user)}
    >
      {children}
    </ChallengeShell>
  );
}
