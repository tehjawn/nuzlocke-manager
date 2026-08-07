import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { GetStartedView } from "@/components/GetStartedView";
import { getChallengeMeta } from "@/lib/challenges";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { getAccessForChallenge } from "@/lib/permissions";
import {
  canViewWelcomeVideo,
  formatWelcomeVideoPublishAtEastern,
  resolveSeasonRomUrl,
  resolveSeasonWelcomeVideoUrl,
  resolveWelcomeVideoEmbed,
} from "@/lib/welcome-video";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallengeMeta(slug);
  return { title: challenge ? `Get Started · ${challenge.name}` : "Get Started" };
}

export default async function SetupPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  // Meta only — ROM / welcome scalars; no trainer Pokémon graph (#365).
  const challenge = await getChallengeMeta(slug, session?.user?.id);
  if (!challenge) notFound();

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;
  // Early preview only when GM view (lens) is on — not merely for having the GM role.
  const gmPreview =
    Boolean(access?.isGm) && (await readGmLensOn(slug));
  const welcomeUrl = resolveSeasonWelcomeVideoUrl(challenge.welcomeVideoUrl);
  const romUrl = resolveSeasonRomUrl(challenge.romUrl);
  const welcomeUnlocked = canViewWelcomeVideo(
    gmPreview,
    challenge.welcomeVideoPublishAt,
  );
  const welcomeEmbed = welcomeUnlocked
    ? resolveWelcomeVideoEmbed(welcomeUrl)
    : null;
  const welcomeLockedMessage = !welcomeUnlocked
    ? welcomeUrl
      ? `Unlocks for everyone at ${formatWelcomeVideoPublishAtEastern(challenge.welcomeVideoPublishAt)}. GMs can change this in the GM console.`
      : null
    : !welcomeUrl && gmPreview
      ? "No welcome video URL configured yet — add one under Season settings in the GM console."
      : null;

  const trainerHref = `/challenges/${challenge.slug}/me`;

  let trainerId: string | null = null;
  let hasImportedSave = false;
  if (session?.user?.id && isDatabaseConfigured() && challenge.id) {
    const trainer = await getPrisma().trainerProfile.findFirst({
      where: { challengeId: challenge.id, userId: session.user.id },
      select: {
        id: true,
        pokemon: {
          where: { slot: "MAIN" },
          select: { id: true },
          take: 1,
        },
      },
    });
    trainerId = trainer?.id ?? null;
    hasImportedSave = Boolean(trainer && trainer.pokemon.length > 0);
  }

  return (
    <GetStartedView
      slug={challenge.slug}
      trainerHref={trainerHref}
      trainerId={trainerId}
      hasImportedSave={hasImportedSave}
      signedIn={Boolean(session?.user)}
      romUrl={romUrl}
      welcomeEmbed={welcomeEmbed}
      welcomeLockedMessage={welcomeLockedMessage}
      welcomeFallbackUrl={welcomeUnlocked ? welcomeUrl : null}
    />
  );
}
