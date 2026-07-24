import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GmConsole } from "@/components/GmConsole";
import { SiteHeader } from "@/components/SiteHeader";
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
  return { title: challenge ? `GM · ${challenge.name}` : "GM" };
}

export default async function GmPage({ params }: PageProps) {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  if (!challenge) notFound();

  if (!challenge.id) {
    redirect(`/challenges/${slug}`);
  }

  const access = await getAccessForChallenge(challenge.id);
  if (!access?.isGm) {
    redirect(`/challenges/${slug}/join`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        challengeSlug={challenge.slug}
        challengeName={challenge.name}
        showGm
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-2 sm:px-6">
        <Link
          href={`/challenges/${challenge.slug}`}
          className="text-sm text-muted hover:text-ink"
        >
          ← League board
        </Link>
        <h1 className="font-display mt-4 text-3xl font-extrabold tracking-tight">
          Game Master console
        </h1>
        <p className="mt-2 text-muted">
          Manage invites, roster locks, rules, and FAQ for this season.
        </p>
        <div className="mt-8">
          <GmConsole challenge={challenge} />
        </div>
      </main>
    </div>
  );
}
