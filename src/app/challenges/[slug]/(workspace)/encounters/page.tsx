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

  return (
    <EncounterSeasonView
      slug={challenge.slug}
      groups={groups}
      highlights={highlights}
      missing={missing}
    />
  );
}
