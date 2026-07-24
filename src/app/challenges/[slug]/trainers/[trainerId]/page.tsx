import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { SiteHeader } from "@/components/SiteHeader";
import { TrainerBoard } from "@/components/TrainerBoard";
import { displayName, getTrainer } from "@/lib/challenges";
import { getAccessForChallenge } from "@/lib/permissions";

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
  const canEdit = Boolean(access?.canEditTrainer(trainer.userId));
  const isDemo = !trainer.userId;
  // Header only needs a truthy id to show “My board” → /me
  const myTrainerId =
    access?.isPlayer
      ? trainer.userId === access.userId
        ? trainer.id
        : access.userId
      : null;

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        challengeSlug={challenge.slug}
        challengeName={challenge.name}
        showGm={Boolean(access?.isGm)}
        myTrainerId={myTrainerId}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 pb-16 pt-2 sm:px-6">
        <DataSourceBanner source={challenge.source} />
        <Link
          href={`/challenges/${challenge.slug}`}
          className="text-sm text-muted hover:text-ink"
        >
          ← League board
        </Link>

        <TrainerBoard
          joinHref={`/challenges/${challenge.slug}/join`}
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
