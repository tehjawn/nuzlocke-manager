import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { SeasonStatusBanner } from "@/components/SeasonStatusBanner";
import { TrainersSection } from "@/components/TrainersSection";
import { getChallenge } from "@/lib/challenges";

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

  const trainers = [...challenge.trainers].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  return (
    <>
      <DataSourceBanner source={challenge.source} />
      <div className="mb-4">
        <SeasonStatusBanner slug={challenge.slug} status={challenge.status} />
      </div>

      <TrainersSection challenge={challenge} trainers={trainers} />
    </>
  );
}
