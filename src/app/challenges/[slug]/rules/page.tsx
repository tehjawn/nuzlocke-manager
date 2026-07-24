import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ChallengeShell } from "@/components/ChallengeShell";
import { Frame } from "@/components/Frame";
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
  return { title: challenge ? `Rules · ${challenge.name}` : "Rules" };
}

export default async function RulesPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallenge(slug, session?.user?.id);
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
    }
  }

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;

  return (
    <ChallengeShell
      slug={challenge.slug}
      name={challenge.name}
      year={challenge.year}
      showGm={Boolean(access?.isGm)}
      myTrainerId={myTrainerId}
    >
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Rules
        </h1>
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
    </ChallengeShell>
  );
}
