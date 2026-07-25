import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Frame } from "@/components/Frame";
import { JoinForm } from "@/components/JoinForm";
import { SiteHeader } from "@/components/SiteHeader";
import { getChallenge } from "@/lib/challenges";
import { getAccessForChallenge } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ gm?: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  return { title: challenge ? `Join · ${challenge.name}` : "Join" };
}

export default async function JoinPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { gm } = await searchParams;
  const session = await auth();
  const challenge = await getChallenge(slug);
  if (!challenge) redirect("/challenges");

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;

  // Normal path: logged-in players go straight to their board
  if (session?.user?.id && gm !== "1" && !access?.isGm) {
    redirect(`/challenges/${slug}/me`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        challengeSlug={challenge.slug}
        challengeName={challenge.name}
        showGm={Boolean(access?.isGm)}
      />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-16 pt-2 sm:px-6">
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          {session?.user ? "Game Master access" : "Sign in to join"}
        </h1>
        <p className="mt-2 text-muted">
          {session?.user
            ? "Enter the GM invite code to manage this season."
            : "Discord login automatically joins the 2026 league and opens your trainer board."}
        </p>

        <div className="mt-8 space-y-4">
          {!session?.user ? (
            <Frame title="Discord">
              <a
                href="/login"
                className="pressable inline-block rounded-xl bg-accent px-4 py-3 text-xs font-semibold tracking-tight text-[var(--on-accent)]"
              >
                Continue with Discord
              </a>
            </Frame>
          ) : (
            <Frame title="GM invite code">
              <JoinForm slug={challenge.slug} mode="gm" />
            </Frame>
          )}
        </div>
      </main>
    </div>
  );
}
