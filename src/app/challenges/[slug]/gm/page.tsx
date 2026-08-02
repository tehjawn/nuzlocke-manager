import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GmConsole } from "@/components/GmConsole";
import { SiteHeader, SITE_SHELL_MAX_CLASS } from "@/components/SiteHeader";
import {
  SeasonJumpRegistrar,
  challengeToJumpSeasonContext,
} from "@/features/jump";
import type { Challenge } from "@/lib/challenge-types";
import { getChallenge } from "@/lib/challenges";
import { getPrisma } from "@/lib/db";
import { getAccessForChallenge } from "@/lib/permissions";


type PageProps = {
  params: Promise<{ slug: string }>;
};

/** Console does not need live party rows or the activity feed — strip before Flight. */
function toGmConsoleChallenge(
  challenge: Challenge,
  discordWebhookUrl: string | null,
): Challenge {
  return {
    ...challenge,
    discordWebhookUrl,
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

export default async function GmPage({ params }: PageProps) {
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
      select: { discordWebhookUrl: true },
    }),
  ]);
  if (!access?.isGm) {
    redirect(`/challenges/${slug}/join?gm=1`);
  }

  const jumpSeason = challengeToJumpSeasonContext(challenge, { showGm: true });

  return (
    <div className="gm-console-page flex flex-1 flex-col">
      <SeasonJumpRegistrar season={jumpSeason} />
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
          challenge={toGmConsoleChallenge(
            challenge,
            secrets?.discordWebhookUrl ?? null,
          )}
        />
      </main>
    </div>
  );
}
