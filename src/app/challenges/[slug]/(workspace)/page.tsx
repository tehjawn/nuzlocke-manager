import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { SeasonStatusBanner } from "@/components/SeasonStatusBanner";
import { TrainersSection } from "@/components/TrainersSection";
import { getChallenge } from "@/lib/challenges";
import { getAccessForChallenge } from "@/lib/permissions";
import { redactTrainerCompetitiveDetails } from "@/lib/pokemon-privacy";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  if (!challenge) return { title: "Challenge" };
  return { title: challenge.name };
}

export default async function LeagueBoardPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallenge(slug, session?.user?.id);
  if (!challenge) notFound();

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;
  const myTrainerId =
    challenge.trainers.find((t) => t.userId === session?.user?.id)?.id ?? null;

  // Owners + GMs keep competitive fields; everyone else gets a redacted payload.
  const competitiveTrainerIds = challenge.trainers
    .filter((t) => access?.canEditTrainer(t.userId))
    .map((t) => t.id);
  const competitiveIdSet = new Set(competitiveTrainerIds);

  const trainers = [...challenge.trainers]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((trainer) =>
      competitiveIdSet.has(trainer.id)
        ? trainer
        : redactTrainerCompetitiveDetails(trainer),
    );

  return (
    <>
      <DataSourceBanner source={challenge.source} />
      <div className="mb-4">
        <SeasonStatusBanner slug={challenge.slug} status={challenge.status} />
      </div>

      <TrainersSection
        challenge={{ ...challenge, trainers }}
        trainers={trainers}
        myTrainerId={myTrainerId}
        competitiveTrainerIds={competitiveTrainerIds}
      />
    </>
  );
}
