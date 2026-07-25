import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { TrainerCompare } from "@/components/TrainerCompare";
import { getChallenge } from "@/lib/challenges";

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
  return { title: challenge ? `Compare · ${challenge.name}` : "Compare" };
}

export default async function ComparePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { a, b } = await searchParams;
  const session = await auth();
  const challenge = await getChallenge(slug, session?.user?.id);
  if (!challenge) notFound();

  return (
    <>
      <header className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Compare trainers</h2>
        <p className="mt-2 text-muted">
          Side-by-side squads and badges — pick any two boards in the season.
        </p>
      </header>
      <TrainerCompare
        slug={challenge.slug}
        trainers={challenge.trainers}
        badges={challenge.badges}
        initialA={a}
        initialB={b}
      />
    </>
  );
}
