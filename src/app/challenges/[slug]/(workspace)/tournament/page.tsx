import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { SeasonStatusBanner } from "@/components/SeasonStatusBanner";
import { TournamentBracket } from "@/components/TournamentBracket";
import { getChallenge } from "@/lib/challenges";
import { getAccessForChallenge } from "@/lib/permissions";
import { getTournamentForChallenge } from "@/lib/tournament";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  if (!challenge) return { title: "Tournament" };
  return { title: `Tournament · ${challenge.name}` };
}

export default async function TournamentPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallenge(slug, session?.user?.id);
  if (!challenge) notFound();

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;
  const tournament = challenge.id
    ? await getTournamentForChallenge(challenge.id)
    : null;

  return (
    <>
      <DataSourceBanner source={challenge.source} />
      <div className="mb-4">
        <SeasonStatusBanner slug={challenge.slug} status={challenge.status} />
      </div>
      <TournamentBracket
        challenge={challenge}
        tournament={tournament}
        isGm={Boolean(access?.isGm)}
      />
    </>
  );
}
