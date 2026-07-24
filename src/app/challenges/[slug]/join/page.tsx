import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Frame } from "@/components/Frame";
import { JoinForm } from "@/components/JoinForm";
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
          Join {challenge.name}
        </h1>
        <p className="mt-2 text-muted">
          Enter a player or Game Master invite code after signing in with
          Discord.
        </p>

        <div className="mt-8 space-y-4">
          {!session?.user ? (
            <Frame title="Sign in first">
              <Link
                href="/login"
                className="pressable inline-block rounded-sm bg-accent px-4 py-2 font-display text-xs font-bold tracking-wide text-white uppercase"
              >
                Discord login
              </Link>
            </Frame>
          ) : (
            <Frame title="Invite code">
              {challenge.source === "database" ? (
                <>
                  <JoinForm slug={challenge.slug} />
                  {access?.role ? (
                    <p className="mt-3 text-sm text-accent-deep">
                      Current role: {access.role}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted">
                  Seed/demo mode — configure DATABASE_URL and run{" "}
                  <code>npm run db:seed</code> to enable invites. Default codes
                  after seed: <code>TRASHPACK2026</code> (player) /{" "}
                  <code>TRASHPACK-GM</code> (GM).
                </p>
              )}
            </Frame>
          )}

          <Frame title="Then claim a trainer">
            <p className="text-sm leading-relaxed text-muted">
              Open an unclaimed trainer board and tap{" "}
              <strong>Claim</strong>. One trainer per player unless a GM
              reassigns.
            </p>
          </Frame>
        </div>
      </main>
    </div>
  );
}
