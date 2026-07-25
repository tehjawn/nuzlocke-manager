import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { SiteHeader } from "@/components/SiteHeader";
import { TrainerBoard } from "@/components/TrainerBoard";
import { SeasonStatusBanner } from "@/components/SeasonStatusBanner";
import { getTrainer } from "@/lib/challenges";
import { displayName } from "@/lib/trainer-display";
import { getAccessForChallenge } from "@/lib/permissions";
import { isSeasonReadOnly } from "@/lib/season-status";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string; trainerId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, trainerId } = await params;
  const result = await getTrainer(slug, trainerId);
  if (!result) return { title: "Trainer" };
  return { title: displayName(result.trainer) };
}

export default async function TrainerBoardPage({ params }: PageProps) {
  const { slug, trainerId } = await params;
  const result = await getTrainer(slug, trainerId);
  if (!result) notFound();

  const { challenge, trainer } = result;
  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;
  const canEdit =
    Boolean(access?.canEditTrainer(trainer.userId)) &&
    !isSeasonReadOnly(challenge.status);
  const isDemo = !trainer.userId;
  // Header only needs a truthy id to show “My Trainer” → /me
  const myTrainerId =
    access?.isPlayer
      ? trainer.userId === access.userId
        ? trainer.id
        : access.userId
      : null;
  const myBoardHref = access
    ? `/challenges/${challenge.slug}/me`
    : null;

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        challengeSlug={challenge.slug}
        challengeYear={challenge.year}
        showGm={Boolean(access?.isGm)}
        myTrainerId={myTrainerId}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 pb-16 pt-2 sm:px-6">
        <DataSourceBanner source={challenge.source} />
        <SeasonStatusBanner slug={challenge.slug} status={challenge.status} />
        <Link
          href={`/challenges/${challenge.slug}`}
          className="pressable inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold tracking-tight text-[var(--on-accent)]"
        >
          <span aria-hidden>←</span>
          {challenge.year} League Board
        </Link>

        <TrainerBoard
          joinHref={`/challenges/${challenge.slug}/join`}
          myBoardHref={myBoardHref}
          trainer={trainer}
          badges={challenge.badges}
          canEdit={canEdit}
          isGm={Boolean(access?.isGm)}
          isDemo={isDemo}
        />
      </main>
    </div>
  );
}
