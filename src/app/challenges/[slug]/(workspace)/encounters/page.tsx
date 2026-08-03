import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { EncounterSeasonView } from "@/components/EncounterSeasonView";
import { getChallenge } from "@/lib/challenges";
import { buildEncounterLedger } from "@/lib/encounter-ledger";
import {
  encounterSeasonHighlights,
  missingModernEmeraldSpecies,
} from "@/lib/encounter-stats";
import { buildPersonalRouteStatuses } from "@/lib/personal-routes";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  return {
    title: challenge ? `Encounters · ${challenge.name}` : "Encounters",
  };
}

export default async function EncountersPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallenge(slug, session?.user?.id);
  if (!challenge) notFound();

  const groups = buildEncounterLedger(challenge.trainers);
  const highlights = encounterSeasonHighlights(challenge.trainers);
  const missing = missingModernEmeraldSpecies(challenge.trainers);
  const myTrainerId =
    challenge.trainers.find((trainer) => trainer.userId === session?.user?.id)
      ?.id ?? null;
  const routeStatuses = buildPersonalRouteStatuses(challenge.trainers);

  return (
    <EncounterSeasonView
      groups={groups}
      highlights={highlights}
      missing={missing}
      myTrainerId={myTrainerId}
      routeStatuses={routeStatuses}
      slug={challenge.slug}
    />
  );
}
