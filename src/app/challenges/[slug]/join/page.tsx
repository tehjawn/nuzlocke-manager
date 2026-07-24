import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Frame } from "@/components/Frame";
import { JoinForm } from "@/components/JoinForm";
import { SiteHeader } from "@/components/SiteHeader";
import { getChallenge } from "@/lib/challenges";
import { isDatabaseConfigured } from "@/lib/db";
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
  return { title: challenge ? `Join · ${challenge.name}` : "Join" };
}

export default async function JoinPage({ params }: PageProps) {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  if (!challenge) notFound();

  const session = await auth();
  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;

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

  const isPublic =
    challenge.visibility === "PUBLIC" || challenge.visibility === "UNLISTED";

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        challengeSlug={challenge.slug}
        challengeName={challenge.name}
        showGm={Boolean(access?.isGm)}
      />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-16 pt-2 sm:px-6">
        <Link
          href={`/challenges/${challenge.slug}`}
          className="text-sm text-muted hover:text-ink"
        >
          ← League board
        </Link>
        <h1 className="font-display mt-4 text-3xl font-extrabold tracking-tight">
          {myTrainerId ? "Your trainer board" : `Join ${challenge.name}`}
        </h1>
        <p className="mt-2 text-muted">
          {myTrainerId
            ? "You’re in this season. Edit your board anytime."
            : isPublic
              ? "Sign in with Discord and we’ll create your trainer board automatically."
              : "This season needs an invite code from a Game Master."}
        </p>

        <div className="mt-8 space-y-4">
          {!session?.user ? (
            <Frame title="Sign in">
              <Link
                href="/login"
                className="pressable inline-block rounded-sm bg-accent px-4 py-2 font-display text-xs font-bold tracking-wide text-white uppercase"
              >
                Discord login
              </Link>
            </Frame>
          ) : myTrainerId ? (
            <Frame title="Ready">
              <p className="mb-3 text-sm text-muted">
                Role: {access?.role ?? "PLAYER"}
              </p>
              <Link
                href={`/challenges/${challenge.slug}/trainers/${myTrainerId}`}
                className="pressable inline-block rounded-sm bg-accent px-4 py-3 font-display text-xs font-bold tracking-wide text-white uppercase"
              >
                Open my board
              </Link>
            </Frame>
          ) : challenge.source !== "database" || !isDatabaseConfigured() ? (
            <Frame title="Database required">
              <p className="text-sm text-muted">
                Trainer provisioning needs a live database. Demo seed mode is
                read-only.
              </p>
            </Frame>
          ) : (
            <Frame title={isPublic ? "Get started" : "Invite code"}>
              {isPublic ? (
                <JoinForm slug={challenge.slug} mode="enter" />
              ) : (
                <JoinForm slug={challenge.slug} mode="invite" needsInvite />
              )}
            </Frame>
          )}

          {session?.user && !access?.isGm ? (
            <Frame title="Game Master?">
              <p className="mb-3 text-sm text-muted">
                Optional — elevate with a GM code if you run the season.
              </p>
              <JoinForm slug={challenge.slug} mode="gm" />
            </Frame>
          ) : null}

          <Frame title="About Ash">
            <p className="text-sm leading-relaxed text-muted">
              <strong>Ash Ketchum</strong> on the league board is a demo
              example only — not a claimable slot. Your Discord login creates{" "}
              <em>your</em> trainer.
            </p>
          </Frame>
        </div>
      </main>
    </div>
  );
}
