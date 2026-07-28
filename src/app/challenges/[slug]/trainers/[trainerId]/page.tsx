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
import {
  canEditTrainerBoard,
  canViewCompetitiveDetails,
} from "@/lib/gm-lens";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { redactTrainerCompetitiveDetails } from "@/lib/pokemon-privacy";
import { displayName } from "@/lib/trainer-display";
import { getAccessForChallenge } from "@/lib/permissions";
import { isSeasonReadOnly } from "@/lib/season-status";

export const dynamic = "force-dynamic";

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

  const showGm = Boolean(access?.isGm);
  // Board-level GM tools (e.g. revive reset) follow the same lens gate.
  const boardGm = showGm && (access?.ownsTrainer(trainer.userId) || gmLensOn);

  return (
    <div className="flex flex-1 flex-col">
      <SeasonJumpRegistrar
        season={challengeToJumpSeasonContext(challenge, {
          showGm,
          myTrainerId,
        })}
      />
      <SiteHeader
        challengeSlug={challenge.slug}
        challengeYear={challenge.year}
        showGm={showGm}
        myTrainerId={myTrainerId}
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
          trainer={boardTrainer}
          badges={challenge.badges}
          canEdit={canEdit}
          showCompetitiveDetails={canViewCompetitive}
          isGm={Boolean(boardGm)}
          isDemo={isDemo}
        />
      </main>
    </div>
  );
}
