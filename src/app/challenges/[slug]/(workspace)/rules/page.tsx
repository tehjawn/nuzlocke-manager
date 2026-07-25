import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Frame } from "@/components/Frame";
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
  return { title: challenge ? `Rules · ${challenge.name}` : "Rules" };
}

export default async function RulesPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallenge(slug, session?.user?.id);
  if (!challenge) notFound();

  return (
    <>
      <header className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">
          Rules
        </h2>
        <p className="mt-2 text-muted">
          How {challenge.name} works. Core Nuzlocke rules first, house rules
          after.
        </p>
      </header>

      <ol className="space-y-4">
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
    </>
  );
}
