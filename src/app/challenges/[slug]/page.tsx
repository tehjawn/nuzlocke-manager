import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ChallengeShell } from "@/components/ChallengeShell";
import { DataSourceBanner } from "@/components/DataSourceBanner";
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
      game={challenge.game}
      description={challenge.description}
      activities={challenge.activities ?? []}
      canReact={Boolean(session?.user?.id && challenge.source === "database")}
      showGm={Boolean(access?.isGm)}
      myTrainerId={myTrainerId}
      signedIn={Boolean(session?.user)}
    >
      <DataSourceBanner source={challenge.source} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold tracking-tight">
            Players
          </h2>
          <p className="text-xs text-muted">{trainers.length} on the board</p>
        </div>
        <div className="grid gap-4">
          {trainers.map((trainer) => (
            <TrainerCard
              key={trainer.id}
              challenge={challenge}
              trainer={trainer}
            />
          ))}
        </div>
      </section>
    </ChallengeShell>
  );
}
