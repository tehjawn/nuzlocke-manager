import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { SeasonStatusBanner } from "@/components/SeasonStatusBanner";
import { TournamentLobby } from "@/components/TournamentLobby";
import { canViewChallenge } from "@/lib/challenge-access";
import { getChallengeMeta, getChallengeTournament } from "@/lib/challenges";
import { getAccessForChallenge } from "@/lib/permissions";
import { listTournamentsForChallenge } from "@/lib/tournament";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallengeMeta(slug);
  if (!challenge) return { title: "Tournaments" };
  return { title: `Tournaments · ${challenge.name}` };
}

export default async function TournamentsPage({ params }: PageProps) {
  const { slug } = await params;
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

  const tournaments = challenge.id
    ? await listTournamentsForChallenge(challenge.id)
    : [];

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
      <TournamentLobby
        challenge={challenge}
        tournaments={tournaments}
        isGm={Boolean(access?.isGm)}
      />
    </>
  );
}
