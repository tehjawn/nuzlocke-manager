import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GmConsole } from "@/components/GmConsole";
import { SiteHeader, SITE_SHELL_MAX_CLASS } from "@/components/SiteHeader";
import {
  SeasonJumpRegistrar,
  challengeToJumpSeasonContext,
} from "@/features/jump";
import { getChallenge } from "@/lib/challenges";
import { getPrisma } from "@/lib/db";
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
    redirect(`/challenges/${slug}/join?gm=1`);
  }

  const secrets = await getPrisma().challenge.findUnique({
    where: { id: challenge.id },
    select: { discordWebhookUrl: true },
  });

  return (
    <div className="flex flex-1 flex-col">
      <SeasonJumpRegistrar
        season={challengeToJumpSeasonContext(challenge, { showGm: true })}
      />
      <SiteHeader
        challengeSlug={challenge.slug}
        challengeYear={challenge.year}
        challengeName={challenge.name}
        showGm
      />
      <main
        className={`mx-auto w-full flex-1 px-4 pb-16 pt-2 sm:px-6 ${SITE_SHELL_MAX_CLASS}`}
      >
        <Link
          href={`/challenges/${challenge.slug}`}
          className="pressable inline-flex h-9 items-center gap-1.5 border-frame/70 bg-surface-2/60 px-3 text-xs font-semibold tracking-tight text-muted hover:border-frame hover:bg-surface-2 hover:text-ink"
        >
          <span aria-hidden>←</span>
          {challenge.year} League Board
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          Game Master console
        </h1>
        <p className="mt-2 text-muted">
          Manage season status, invites, Discord alerts, exports, roster locks,
          rules, and FAQ.
        </p>
        <div className="mt-8">
          <GmConsole
            challenge={{
              ...challenge,
              discordWebhookUrl: secrets?.discordWebhookUrl ?? null,
            }}
          />
        </div>
      </main>
    </div>
  );
}
