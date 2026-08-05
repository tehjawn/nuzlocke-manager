import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GmConsole } from "@/components/GmConsole";
import { SiteHeader, SITE_SHELL_MAX_CLASS } from "@/components/SiteHeader";
import {
  SeasonSearchRegistrar,
  challengeToSearchSeasonContext,
} from "@/features/search";
import type { Challenge } from "@/lib/challenge-types";
import { getChallenge } from "@/lib/challenges";
import { getPrisma } from "@/lib/db";
import { listFeedbackForGm } from "@/lib/feedback";
import { getAccessForChallenge } from "@/lib/permissions";


type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
};

/** Console does not need live party rows or the activity feed — strip before Flight. */
function toGmConsoleChallenge(
  challenge: Challenge,
  secrets: {
    discordWebhookUrl: string | null;
    playerInviteCode: string | null;
    gmInviteCode: string | null;
  },
): Challenge {
  return {
    ...challenge,
    discordWebhookUrl: secrets.discordWebhookUrl,
    playerInviteCode: secrets.playerInviteCode,
    gmInviteCode: secrets.gmInviteCode,
    activities: undefined,
    trainers: challenge.trainers.map((t) => ({
      ...t,
      pokemon: [],
    })),
  };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  return { title: challenge ? `GM · ${challenge.name}` : "GM" };
}

export default async function GmPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  if (!challenge) notFound();

  if (!challenge.id) {
    redirect(`/challenges/${slug}`);
  }

  const [access, secrets] = await Promise.all([
    getAccessForChallenge(challenge.id),
    getPrisma().challenge.findUnique({
      where: { id: challenge.id },
      select: {
        discordWebhookUrl: true,
        playerInviteCode: true,
        gmInviteCode: true,
      },
    }),
  ]);
  if (!access?.isGm) {
    redirect(`/challenges/${slug}/join?gm=1`);
  }

  const [feedbackSubmissions, query] = await Promise.all([
    listFeedbackForGm(challenge.id),
    searchParams,
  ]);
  const searchSeason = challengeToSearchSeasonContext(challenge, { showGm: true });

  return (
    <div className="gm-console-page flex flex-1 flex-col">
      <SeasonSearchRegistrar season={searchSeason} />
      <SiteHeader
        challengeSlug={challenge.slug}
        challengeYear={challenge.year}
        challengeName={challenge.name}
        showGm
      />
      <main
        className={`relative mx-auto w-full flex-1 px-4 pb-20 pt-4 sm:px-6 ${SITE_SHELL_MAX_CLASS}`}
      >
        <GmConsole
          challenge={toGmConsoleChallenge(challenge, {
            discordWebhookUrl: secrets?.discordWebhookUrl ?? null,
            playerInviteCode: secrets?.playerInviteCode ?? null,
            gmInviteCode: secrets?.gmInviteCode ?? null,
          })}
          feedbackSubmissions={feedbackSubmissions}
          initialTab={query.tab === "feedback" ? "feedback" : "season"}
          key={query.tab === "feedback" ? "feedback" : "season"}
        />
      </main>
    </div>
  );
}
