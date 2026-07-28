import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Frame } from "@/components/Frame";
import { TrainerCompare } from "@/components/TrainerCompare";
import { TypeChartPanel } from "@/components/TypeChartPanel";
import { getChallenge } from "@/lib/challenges";
import { getAccessForChallenge } from "@/lib/permissions";
import { redactTrainerCompetitiveDetails } from "@/lib/pokemon-privacy";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  return { title: challenge ? `Tools · ${challenge.name}` : "Tools" };
}

export default async function ToolsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { a, b } = await searchParams;
  const session = await auth();
  const challenge = await getChallenge(slug, session?.user?.id);
  if (!challenge) notFound();

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;
  // Compare UI is sprite-level, but still redact for viewers who shouldn't
  // receive competitive fields in the RSC payload.
  const trainers = challenge.trainers.map((trainer) =>
    access?.canEditTrainer(trainer.userId)
      ? trainer
      : redactTrainerCompetitiveDetails(trainer),
  );

  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Tools</h2>
        <p className="mt-2 text-muted">
          Quick-ref type chart and side-by-side trainer compare for{" "}
          {challenge.name}.
        </p>
      </header>

      <section className="space-y-3">
        <h3 className="text-lg font-bold tracking-tight">Type Chart</h3>
        <Frame>
          <TypeChartPanel />
        </Frame>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold tracking-tight">Compare trainers</h3>
        <p className="text-sm text-muted">
          Side-by-side squads and badges — pick any two boards in the season.
        </p>
        <TrainerCompare
          slug={challenge.slug}
          trainers={trainers}
          badges={challenge.badges}
          initialA={a}
          initialB={b}
        />
      </section>
    </div>
  );
}
