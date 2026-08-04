import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { SiteHeader, SITE_SHELL_MAX_CLASS } from "@/components/SiteHeader";
import { TrainerBoard } from "@/components/TrainerBoard";
import { SeasonStatusBanner } from "@/components/SeasonStatusBanner";
import {
  SeasonJumpRegistrar,
  challengeToJumpSeasonContext,
} from "@/features/jump";
import { canViewChallenge } from "@/lib/challenge-access";
import { getTrainer } from "@/lib/challenges";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { FORCE_FIRST_RUN_CHROME, isFirstRunChrome } from "@/lib/first-run";
import {
  canEditTrainerBoard,
  canViewCompetitiveDetails,
} from "@/lib/gm-lens";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { getWelcomeReadAt } from "@/lib/notifications";
import { redactTrainerCompetitiveDetails } from "@/lib/pokemon-privacy";
import { displayName } from "@/lib/trainer-display";
import { getAccessForChallenge } from "@/lib/permissions";
import { isSeasonReadOnly } from "@/lib/season-status";


type PageProps = {
  params: Promise<{ slug: string; trainerId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, trainerId } = await params;
  const result = await getTrainer(slug, trainerId);
  if (!result) return { title: "Trainer" };

  const access = result.challenge.id
    ? await getAccessForChallenge(result.challenge.id)
    : null;
  if (
    !canViewChallenge({
      visibility: result.challenge.visibility,
      source: result.challenge.source,
      hasMembership: Boolean(access?.role),
    })
  ) {
    // Don't leak trainer names for invite-gated seasons.
    return { title: "Trainer" };
  }

  return { title: displayName(result.trainer) };
}

export default async function TrainerBoardPage({ params }: PageProps) {
  const { slug, trainerId } = await params;
  const result = await getTrainer(slug, trainerId);
  if (!result) notFound();

  const { challenge, trainer } = result;
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

  const gmLensOn = access?.isGm
    ? await readGmLensOn(challenge.slug)
    : false;
  const canViewCompetitive = canViewCompetitiveDetails(
    access,
    trainer.userId,
    gmLensOn,
  );
  const canEdit = canEditTrainerBoard(
    access,
    trainer.userId,
    gmLensOn,
    isSeasonReadOnly(challenge.status),
  );

  // Own board without /new-trainer completion → finish intro first.
  if (
    canEdit &&
    access?.ownsTrainer(trainer.userId) &&
    isDatabaseConfigured()
  ) {
    const intro = await getPrisma().trainerProfile.findUnique({
      where: { id: trainer.id },
      select: { introCompletedAt: true },
    });
    if (intro && !intro.introCompletedAt) {
      redirect(`/challenges/${slug}/new-trainer`);
    }
  }

  const boardTrainer = canViewCompetitive
    ? trainer
    : redactTrainerCompetitiveDetails(trainer);
  const isDemo = !trainer.userId;
  // Header only needs a truthy id to show “My Trainer” → /me
  const myTrainerId =
    access?.isPlayer
      ? trainer.userId === access.userId
        ? trainer.id
        : access.userId
      : null;
  const myBoardHref = access
    ? `/challenges/${challenge.slug}/me`
    : null;

  const showGm = Boolean(access?.isGm) && !FORCE_FIRST_RUN_CHROME;
  // Board-level GM tools (e.g. revive reset) follow the same GM-view gate.
  const boardGm =
    Boolean(access?.isGm) &&
    !FORCE_FIRST_RUN_CHROME &&
    (access?.ownsTrainer(trainer.userId) || gmLensOn);

  const welcomeReadAt = access?.userId
    ? await getWelcomeReadAt(access.userId)
    : null;

  // First-run chrome follows the signed-in player's own progress — not whether
  // they can edit this particular board (other trainers / read-only seasons).
  let hasProgress = false;
  if (access?.userId && challenge.id && isDatabaseConfigured()) {
    if (trainer.userId === access.userId) {
      hasProgress = trainer.pokemon.some((p) => p.slot === "MAIN");
    } else {
      const mine = await getPrisma().pokemonEntry.count({
        where: {
          slot: "MAIN",
          trainer: {
            challengeId: challenge.id,
            userId: access.userId,
          },
        },
      });
      hasProgress = mine > 0;
    }
  }

  const firstRun = isFirstRunChrome({
    signedIn: Boolean(access?.userId),
    welcomeCompleted: welcomeReadAt != null,
    hasProgress,
    isGm: Boolean(access?.isGm),
  });

  let encourageImportSave = false;
  if (canEdit && isDatabaseConfigured()) {
    const hasMain = trainer.pokemon.some((p) => p.slot === "MAIN");
    if (!hasMain) {
      const imported = await getPrisma().trainerBoardSnapshot.count({
        where: { trainerId: trainer.id, trigger: "IMPORT" },
      });
      // Persistent glow only before the first import (and with an empty Main).
      encourageImportSave = imported === 0;
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <SeasonJumpRegistrar
        season={challengeToJumpSeasonContext(challenge, {
          showGm,
          myTrainerId,
          firstRun,
        })}
      />
      <SiteHeader
        challengeSlug={challenge.slug}
        challengeYear={challenge.year}
        challengeName={challenge.name}
        showGm={showGm}
        myTrainerId={myTrainerId}
        firstRun={firstRun}
      />
      <main
        className={`mx-auto w-full flex-1 space-y-6 px-4 pb-16 pt-2 sm:px-6 ${SITE_SHELL_MAX_CLASS}`}
      >
        <DataSourceBanner source={challenge.source} />
        <SeasonStatusBanner slug={challenge.slug} status={challenge.status} />

        <TrainerBoard
          leagueBoardHref={`/challenges/${challenge.slug}`}
          leagueBoardLabel={`${challenge.year} League Board`}
          joinHref={`/challenges/${challenge.slug}/join`}
          myBoardHref={myBoardHref}
          challengeSlug={challenge.slug}
          challengeName={challenge.name}
          challengeGame={challenge.game}
          trainer={boardTrainer}
          badges={challenge.badges}
          canEdit={canEdit}
          showCompetitiveDetails={canViewCompetitive}
          isGm={Boolean(boardGm)}
          isDemo={isDemo}
          encourageImportSave={encourageImportSave}
        />
      </main>
    </div>
  );
}
