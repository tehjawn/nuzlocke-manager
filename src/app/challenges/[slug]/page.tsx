import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ChallengeShell } from "@/components/ChallengeShell";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { Frame } from "@/components/Frame";
import { TrainerCard } from "@/components/TrainerCard";
import { getChallenge } from "@/lib/challenges";
import { getAccessForChallenge } from "@/lib/permissions";
import { ensureTrainerForChallenge } from "@/lib/provision";

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
  let challenge = await getChallenge(slug, session?.user?.id);
  if (!challenge) notFound();

  let myTrainerId: string | null = null;

  if (session?.user?.id && challenge.source === "database") {
    const provisioned = await ensureTrainerForChallenge({
      userId: session.user.id,
      slug: challenge.slug,
      allowAutoJoin: challenge.visibility !== "INVITE",
    });
    if (provisioned.ok) {
      myTrainerId = provisioned.trainerId;
      if (provisioned.created) {
        challenge =
          (await getChallenge(slug, session.user.id)) ?? challenge;
      }
    }
  }

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;

  const trainers = [...challenge.trainers].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  return (
    <ChallengeShell
      slug={challenge.slug}
      name={challenge.name}
      year={challenge.year}
      showGm={Boolean(access?.isGm)}
      myTrainerId={myTrainerId}
      wide
    >
      <DataSourceBanner source={challenge.source} />

      <div className="mt-2 space-y-6 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_320px] 2xl:items-start 2xl:gap-6 2xl:space-y-0">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-xl font-extrabold tracking-tight">
              Trainers
            </h2>
            <p className="text-xs text-muted">{trainers.length} on the board</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {trainers.map((trainer) => (
              <TrainerCard
                key={trainer.id}
                challenge={challenge}
                trainer={trainer}
              />
            ))}
          </div>
        </section>

        <aside className="grid gap-4 sm:grid-cols-2 2xl:sticky 2xl:top-4 2xl:grid-cols-1 2xl:self-start">
          <Frame title="General info">
            <p className="font-display text-xs font-bold tracking-[0.18em] text-accent-deep uppercase">
              League board · {challenge.year}
            </p>
            <h1 className="font-display mt-1 text-2xl font-extrabold tracking-tight">
              {challenge.name}
            </h1>
            {challenge.game ? (
              <p className="mt-1 text-sm text-muted">{challenge.game}</p>
            ) : null}
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {challenge.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/challenges/${challenge.slug}/setup`}
                className="pressable rounded-sm bg-accent px-3 py-2 text-sm font-bold text-white"
              >
                Setup guide →
              </Link>
              {!session?.user ? (
                <Link
                  href="/login"
                  className="pressable rounded-sm bg-surface px-3 py-2 text-sm font-bold"
                >
                  Discord login
                </Link>
              ) : null}
            </div>
          </Frame>

          <ActivityFeed
            activities={challenge.activities ?? []}
            canReact={Boolean(
              session?.user?.id && challenge.source === "database",
            )}
          />
        </aside>
      </div>
    </ChallengeShell>
  );
}
