import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { EncounterSeasonView } from "@/components/EncounterSeasonView";
import { getChallengeEncounters, getChallengeMeta } from "@/lib/challenges";
import { buildEncounterLedger } from "@/lib/encounter-ledger";
import { buildPersonalRouteStatuses } from "@/lib/personal-routes";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallengeMeta(slug);
  return {
    title: challenge ? `Catch Map · ${challenge.name}` : "Catch Map",
  };
}

export default async function CatchMapPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallengeEncounters(slug, session?.user?.id);
  if (!challenge) notFound();

  const groups = buildEncounterLedger(challenge.trainers);
  const myTrainerId =
    challenge.trainers.find((trainer) => trainer.userId === session?.user?.id)
      ?.id ?? null;
  const routeStatuses = buildPersonalRouteStatuses(challenge.trainers);

  return (
    <EncounterSeasonView
      groups={groups}
      myTrainerId={myTrainerId}
      routeStatuses={routeStatuses}
      slug={challenge.slug}
    />
  );
}
