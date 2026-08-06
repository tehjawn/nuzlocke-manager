import type { ReactNode } from "react";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  ChallengeShell,
  SEASON_LEFT_RAIL_CLASS,
} from "@/components/ChallengeShell";
import { SITE_SHELL_MAX_CLASS } from "@/components/SiteHeader";
import {
  SeasonSearchRegistrar,
  challengeToSearchSeasonContext,
} from "@/features/search";
import { canViewChallenge } from "@/lib/challenge-access";
import { getChallengeShell } from "@/lib/challenges";
import { FORCE_FIRST_RUN_CHROME, isFirstRunChrome } from "@/lib/first-run";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { getWelcomeReadAt } from "@/lib/notifications";
import { getAccessForChallenge } from "@/lib/permissions";


type LayoutProps = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

/**
 * Shared season chrome (header, info, tabs, headline moments).
 * Soft-navigating between season tabs keeps this layout mounted — only the
 * right-pane page segment swaps.
 *
 * Auth / membership reads stay behind <Suspense> so Cache Components can
 * prerender a shell instead of Prerender-Bypass on every season request.
 */
export default function SeasonWorkspaceLayout({
  children,
  params,
}: LayoutProps) {
  return (
    <Suspense fallback={<SeasonWorkspaceShellFallback />}>
      <SeasonWorkspaceDynamic params={params}>{children}</SeasonWorkspaceDynamic>
    </Suspense>
  );
}

function SeasonWorkspaceShellFallback() {
  return (
    <div className="flex flex-1 flex-col" aria-hidden>
      <div className="h-14 border-b border-frame/20 bg-surface/40" />
      <div
        className={`mx-auto flex w-full flex-1 flex-col gap-6 px-4 pb-16 pt-2 sm:px-6 lg:flex-row lg:items-start ${SITE_SHELL_MAX_CLASS}`}
      >
        <div
          className={`hidden animate-pulse space-y-4 lg:block ${SEASON_LEFT_RAIL_CLASS}`}
        >
          <div className="h-40 rounded-lg border border-frame/20 bg-surface" />
          <div className="h-10 rounded-lg bg-frame/10" />
          <div className="h-48 rounded-lg border border-frame/20 bg-surface" />
        </div>
        <div className="min-w-0 flex-1 animate-pulse space-y-4">
          <div className="h-8 w-40 rounded-lg bg-frame/15" />
          <div className="h-4 w-2/3 max-w-md rounded-lg bg-frame/10" />
          <div className="h-28 rounded-lg border border-frame/20 bg-surface sm:h-36" />
          <div className="h-28 rounded-lg border border-frame/20 bg-surface sm:h-36" />
        </div>
      </div>
    </div>
  );
}

async function SeasonWorkspaceDynamic({
  children,
  params,
}: LayoutProps) {
  const { slug } = await params;
  const session = await auth();
  // The welcome read only needs the session, so it rides alongside the shell
  // fetch instead of queueing behind it (#313).
  const [challenge, welcomeReadAt] = await Promise.all([
    getChallengeShell(slug, session?.user?.id),
    session?.user?.id ? getWelcomeReadAt(session.user.id) : null,
  ]);
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

  // Own board exists but /new-trainer unfinished — finish create before season
  // chrome. The shell row already carries this, so no extra round-trip (#313).
  if (
    session?.user?.id &&
    myTrainer &&
    challenge.source === "database" &&
    !access?.isGm &&
    myTrainer.introCompleted === false
  ) {
    redirect(`/challenges/${slug}/new-trainer`);
  }

  // TEMP: FORCE_FIRST_RUN_CHROME also hides GM chrome so the preview matches
  // a real new-player session.
  const showGm =
    Boolean(access?.isGm) && !FORCE_FIRST_RUN_CHROME;
  const gmViewOn =
    showGm && (await readGmLensOn(slug));
  const firstRun = isFirstRunChrome({
    signedIn: Boolean(session?.user),
    welcomeCompleted: welcomeReadAt != null,
    hasProgress: (myTrainer?.pokemon.length ?? 0) > 0,
    isGm: Boolean(access?.isGm),
  });

  return (
    <>
      <SeasonSearchRegistrar
        season={challengeToSearchSeasonContext(challenge, {
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
        showGm={showGm}
        myTrainerId={myTrainerId}
        signedIn={Boolean(session?.user)}
        firstRun={firstRun}
        gmViewOn={gmViewOn}
      >
        {children}
      </ChallengeShell>
    </>
  );
}
