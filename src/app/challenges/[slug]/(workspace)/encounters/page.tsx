import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { EncounterLedger } from "@/components/EncounterLedger";
import { getChallenge } from "@/lib/challenges";
import { buildEncounterLedger } from "@/lib/encounter-ledger";

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
    title: challenge ? `Encounters · ${challenge.name}` : "Encounters",
  };
}

export default async function EncountersPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallenge(slug, session?.user?.id);
  if (!challenge) notFound();

  const groups = buildEncounterLedger(challenge.trainers);

  return (
    <>
      <header className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Encounter ledger</h2>
        <p className="mt-2 text-muted">
          Light route claims pulled from catch routes on trainer boards — not a
          full encounter tracker.
        </p>
      </header>
      <EncounterLedger slug={challenge.slug} groups={groups} />
    </>
  );
}
