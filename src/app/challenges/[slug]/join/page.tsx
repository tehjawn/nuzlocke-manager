import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DiscordIcon, DISCORD_BTN_CLASS } from "@/components/DiscordIcon";
import { Frame } from "@/components/Frame";
import { JoinForm } from "@/components/JoinForm";
import { SiteHeader, SITE_SHELL_MAX_CLASS } from "@/components/SiteHeader";
import { isInviteOnly } from "@/lib/challenge-access";
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
  const inviteOnly = isInviteOnly(challenge.visibility);
  const wantsGm = gm === "1";

  // Already a member and not elevating → board shortcut
  if (session?.user?.id && access?.role && !wantsGm) {
    redirect(`/challenges/${slug}/me`);
  }

  // Public / unlisted: signed-in players enter without a code
  if (session?.user?.id && !inviteOnly && !wantsGm) {
    redirect(`/challenges/${slug}/me`);
  }

  const title = wantsGm
    ? "Game Master access"
    : inviteOnly
      ? "Invite required"
      : "Sign in to join";

  const blurb = wantsGm
    ? "Enter the GM invite code to manage this season."
    : inviteOnly
      ? session?.user
        ? "This season is invite-only. Enter the player invite code from your Game Master."
        : "This season is invite-only. Sign in with Discord, then enter the invite code."
      : "Discord login automatically joins the 2026 league and opens your trainer board.";

  const loginHref = `/login?callbackUrl=${encodeURIComponent(
    `/challenges/${slug}/join${wantsGm ? "?gm=1" : ""}`,
  )}`;

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        challengeSlug={challenge.slug}
        challengeYear={challenge.year}
        showGm={Boolean(access?.isGm)}
      />
      <main
        className={`mx-auto w-full flex-1 px-4 pb-16 pt-2 sm:px-6 ${SITE_SHELL_MAX_CLASS}`}
      >
        <div className="max-w-lg">
          <h1 className="mt-4 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-muted">{blurb}</p>

          <div className="mt-8 space-y-4">
            {!session?.user ? (
              <Frame title="Discord">
                <a
                  href={loginHref}
                  className={`${DISCORD_BTN_CLASS} px-4 py-3 text-xs tracking-tight`}
                >
                  <DiscordIcon className="h-4 w-4" />
                  Continue with Discord
                </a>
              </Frame>
            ) : null}

            {session?.user && (inviteOnly || wantsGm) ? (
              <Frame title={wantsGm ? "GM invite code" : "Season invite code"}>
                <JoinForm
                  slug={challenge.slug}
                  mode={wantsGm ? "gm" : "invite"}
                />
              </Frame>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
