import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { SeasonStatusBanner } from "@/components/SeasonStatusBanner";
import { TournamentArena } from "@/components/TournamentArena";
import { canViewChallenge } from "@/lib/challenge-access";
import { getChallengeMeta, getChallengeTournament } from "@/lib/challenges";
import { getAccessForChallenge } from "@/lib/permissions";
import { getTournamentById } from "@/lib/tournament";

type PageProps = {
  params: Promise<{ slug: string; tournamentId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, tournamentId } = await params;
  const challenge = await getChallengeMeta(slug);
  const tournament = await getTournamentById(tournamentId);
  if (!challenge) return { title: "Tournament" };
  return {
    title: `${tournament?.name ?? "Tournament"} · ${challenge.name}`,
  };
}

export default async function TournamentDetailPage({ params }: PageProps) {
  const { slug, tournamentId } = await params;
  const session = await auth();
  const challenge = await getChallengeTournament(slug, session?.user?.id);
  if (!challenge) notFound();

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
    notFound();
  }

  const tournament = await getTournamentById(tournamentId);
  if (!tournament || tournament.challengeId !== challenge.id) {
    notFound();
  }

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
      <TournamentArena
        challenge={challenge}
        tournament={tournament}
        isGm={Boolean(access?.isGm)}
      />
    </>
  );
}
