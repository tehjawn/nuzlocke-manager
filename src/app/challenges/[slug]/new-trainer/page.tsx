import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { NewTrainerForm } from "@/components/NewTrainerForm";
import { SiteHeader, SITE_SHELL_MAX_CLASS } from "@/components/SiteHeader";
import { getChallenge, getChallengeAccessFields } from "@/lib/challenges";
import { getPrisma } from "@/lib/db";
import {
  ensureTrainerForChallenge,
  revalidateProvisionedChallenge,
} from "@/lib/provision";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  return {
    title: challenge ? `Create trainer · ${challenge.name}` : "Create trainer",
  };
}

/**
 * Slim first-run personalization (#183): nickname, real name, portrait.
 * Provision still creates the DB board; this is the “create my trainer” moment.
 */
export default async function NewTrainerPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/challenges/${slug}/new-trainer`);
  }

  const access = await getChallengeAccessFields(slug);
  if (!access || access.source !== "database") {
    notFound();
  }

  const challenge = await getChallenge(slug, session.user.id);
  if (!challenge) notFound();

  const result = await ensureTrainerForChallenge({
    userId: session.user.id,
    slug,
    allowAutoJoin: access.visibility !== "INVITE",
  });

  if (!result.ok) {
    redirect(
      result.reason === "invite_required"
        ? `/challenges/${slug}/join`
        : `/challenges/${slug}`,
    );
  }

  revalidateProvisionedChallenge(result.slug);

  const prisma = getPrisma();
  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: result.trainerId },
    select: {
      id: true,
      handle: true,
      realName: true,
      avatarSpriteKey: true,
      introCompletedAt: true,
      user: {
        select: { discordUsername: true },
      },
    },
  });
  if (!trainer) notFound();

  if (trainer.introCompletedAt) {
    redirect(`/challenges/${slug}/trainers/${trainer.id}`);
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteHeader
        challengeSlug={slug}
        challengeName={challenge.name}
        challengeYear={challenge.year}
        firstRun
      />
      <main className={`${SITE_SHELL_MAX_CLASS} px-4 py-8 sm:py-12`}>
        <NewTrainerForm
          trainerId={trainer.id}
          challengeSlug={slug}
          initialHandle={trainer.handle}
          initialRealName={trainer.realName ?? ""}
          initialAvatarSpriteKey={trainer.avatarSpriteKey ?? "brendan"}
          discordUsername={trainer.user?.discordUsername ?? null}
        />
      </main>
    </div>
  );
}
