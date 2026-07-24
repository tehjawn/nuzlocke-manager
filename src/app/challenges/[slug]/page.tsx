import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivityFeed } from "@/components/ActivityFeed";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { SiteHeader } from "@/components/SiteHeader";
import { TrainerCard } from "@/components/TrainerCard";
import { getChallenge } from "@/lib/challenges";
import { getAccessForChallenge } from "@/lib/permissions";

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
  const challenge = await getChallenge(slug);
  if (!challenge) notFound();

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;

  const trainers = [...challenge.trainers].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        challengeSlug={challenge.slug}
        challengeName={challenge.name}
        showGm={Boolean(access?.isGm)}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 pb-16 pt-2 sm:px-6">
        <DataSourceBanner source={challenge.source} />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display text-xs font-bold tracking-[0.18em] text-accent-deep uppercase">
              League board · {challenge.year}
            </p>
            <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {challenge.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
              {challenge.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/challenges/${challenge.slug}/rules`}
              className="pressable rounded-sm bg-surface px-3 py-2 text-sm font-bold"
            >
              Rules
            </Link>
            <Link
              href={`/challenges/${challenge.slug}/faq`}
              className="pressable rounded-sm bg-surface px-3 py-2 text-sm font-bold"
            >
              FAQ
            </Link>
            <Link
              href={`/challenges/${challenge.slug}/join`}
              className="pressable rounded-sm bg-accent px-3 py-2 text-sm font-bold text-white"
            >
              Join
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trainers.map((trainer) => (
            <TrainerCard
              key={trainer.id}
              challenge={challenge}
              trainer={trainer}
            />
          ))}
        </div>

        <ActivityFeed activities={challenge.activities ?? []} />
      </main>
    </div>
  );
}
