import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Frame } from "@/components/Frame";
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
  return { title: challenge ? `Rules · ${challenge.name}` : "Rules" };
}

export default async function RulesPage({ params }: PageProps) {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  if (!challenge) notFound();
  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        challengeSlug={challenge.slug}
        challengeName={challenge.name}
        showGm={Boolean(access?.isGm)}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-2 sm:px-6">
        <Link
          href={`/challenges/${challenge.slug}`}
          className="text-sm text-muted hover:text-ink"
        >
          ← League board
        </Link>
        <h1 className="font-display mt-4 text-3xl font-extrabold tracking-tight">
          Rules
        </h1>
        <p className="mt-2 text-muted">
          How {challenge.name} works. Core Nuzlocke rules first, house rules
          after.
        </p>

        <ol className="mt-8 space-y-4">
          {challenge.rules.map((rule) => (
            <li key={rule.id}>
              <Frame
                title={`${rule.sortOrder}. ${rule.title ?? "Rule"}${rule.isCore ? " · Core" : ""}`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {rule.body}
                </p>
              </Frame>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
