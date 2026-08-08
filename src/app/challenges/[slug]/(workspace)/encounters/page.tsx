import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { EncounterSeasonView } from "@/components/EncounterSeasonView";
import { findHoennMapZone } from "@/data/hoenn-map-zones";
import { getChallengeEncounters, getChallengeMeta } from "@/lib/challenges";
import { buildEncounterLedger } from "@/lib/encounter-ledger";
import { buildPersonalRouteStatuses } from "@/lib/personal-routes";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ route?: string }>;
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

export default async function CatchMapPage({ params, searchParams }: PageProps) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const session = await auth();
  const challenge = await getChallengeEncounters(slug, session?.user?.id);
  if (!challenge) notFound();

  const groups = buildEncounterLedger(challenge.trainers);
  const myTrainerId =
    challenge.trainers.find((trainer) => trainer.userId === session?.user?.id)
      ?.id ?? null;
  const routeStatuses = buildPersonalRouteStatuses(challenge.trainers);
  // Soft-fail unknown `?route=` — map still loads with nothing selected.
  const initialRoute =
    sp.route && findHoennMapZone(sp.route) ? sp.route : null;

  return (
    <EncounterSeasonView
      groups={groups}
      initialRoute={initialRoute}
      myTrainerId={myTrainerId}
      routeStatuses={routeStatuses}
      slug={challenge.slug}
    />
  );
}
