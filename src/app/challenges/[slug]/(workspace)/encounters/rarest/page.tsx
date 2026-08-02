import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { EncounterRarityView } from "@/components/EncounterRarityView";
import { getChallenge } from "@/lib/challenges";
import { encounterSpeciesRarity } from "@/lib/encounter-stats";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  return {
    title: challenge ? `Rarest seen · ${challenge.name}` : "Rarest seen",
  };
}

export default async function RarestSeenPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallenge(slug, session?.user?.id);
  if (!challenge) notFound();

  const entries = encounterSpeciesRarity(challenge.trainers);

  return <EncounterRarityView entries={entries} slug={challenge.slug} />;
}
