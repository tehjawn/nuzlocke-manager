import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { SeasonStatusBanner } from "@/components/SeasonStatusBanner";
import { TrainersSection } from "@/components/TrainersSection";
import {
  getChallengeBoardSummary,
  getChallengeMeta,
} from "@/lib/challenges";
import {
  canViewCompetitiveDetails,
} from "@/lib/gm-lens";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { getAccessForChallenge } from "@/lib/permissions";
import { toPublicTrainerPokemon } from "@/lib/pokemon-privacy";
import { sortTrainersForViewer } from "@/lib/trainer-display";


type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallengeMeta(slug);
  if (!challenge) return { title: "Challenge" };
  return { title: challenge.name };
}

export default async function LeagueBoardPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallengeBoardSummary(slug, session?.user?.id);
  if (!challenge) notFound();

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;
  const gmLensOn = access?.isGm
    ? await readGmLensOn(challenge.slug)
    : false;
  const myTrainerId =
    challenge.trainers.find((t) => t.userId === session?.user?.id)?.id ?? null;

  // Own board always; other boards only with GM view on.
  const competitiveTrainerIds = challenge.trainers
    .filter((t) => canViewCompetitiveDetails(access, t.userId, gmLensOn))
    .map((t) => t.id);
  const competitiveIdSet = new Set(competitiveTrainerIds);

  const trainers = sortTrainersForViewer(challenge.trainers, myTrainerId).map(
    (trainer) =>
      competitiveIdSet.has(trainer.id)
        ? trainer
        : toPublicTrainerPokemon(trainer),
  );

  return (
    <>
      <DataSourceBanner source={challenge.source} />
      <div className="mb-4">
        <SeasonStatusBanner
          slug={challenge.slug}
          status={challenge.status}
          isGm={Boolean(access?.isGm)}
        />
      </div>

      <TrainersSection
        challenge={{
          slug: challenge.slug,
          badges: challenge.badges,
          survivalMarketsEnabled: challenge.survivalMarketsEnabled,
        }}
        trainers={trainers}
        myTrainerId={myTrainerId}
        competitiveTrainerIds={competitiveTrainerIds}
        viewerUserId={access?.userId ?? null}
      />
    </>
  );
}
