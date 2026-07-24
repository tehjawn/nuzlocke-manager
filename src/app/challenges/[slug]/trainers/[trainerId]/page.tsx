import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCase } from "@/components/BadgeCase";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { Frame } from "@/components/Frame";
import { PartyStrip } from "@/components/PartyStrip";
import { ReviveToken } from "@/components/ReviveToken";
import { SiteHeader } from "@/components/SiteHeader";
import { TrainerEditor } from "@/components/TrainerEditor";
import {
  displayName,
  getTrainer,
  pokemonInSlot,
} from "@/lib/challenges";
import { getAccessForChallenge } from "@/lib/permissions";
import { trainerSpriteUrl } from "@/lib/sprites";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string; trainerId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, trainerId } = await params;
  const result = await getTrainer(slug, trainerId);
  if (!result) return { title: "Trainer" };
  return { title: displayName(result.trainer) };
}

export default async function TrainerBoardPage({ params }: PageProps) {
  const { slug, trainerId } = await params;
  const result = await getTrainer(slug, trainerId);
  if (!result) notFound();

  const { challenge, trainer } = result;
  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;
  const canEdit = Boolean(access?.canEditTrainer(trainer.userId));
  const isDemo = !trainer.userId;

  const main = pokemonInSlot(trainer, "MAIN");
  const reserves = pokemonInSlot(trainer, "RESERVE");
  const graveyard = pokemonInSlot(trainer, "GRAVEYARD");

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        challengeSlug={challenge.slug}
        challengeName={challenge.name}
        showGm={Boolean(access?.isGm)}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 pb-16 pt-2 sm:px-6">
        <DataSourceBanner source={challenge.source} />
        <Link
          href={`/challenges/${challenge.slug}`}
          className="text-sm text-muted hover:text-ink"
        >
          ← League board
        </Link>

        <Frame>
          <div className="flex flex-wrap items-start gap-4">
            <Image
              src={trainerSpriteUrl(trainer.avatarSpriteKey)}
              alt=""
              width={96}
              height={96}
              className="pixelated h-24 w-24 object-contain"
              unoptimized
            />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl font-extrabold tracking-tight">
                {displayName(trainer)}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                {trainer.statusText ?? "No status update yet."}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <ReviveToken used={trainer.reviveUsed} />
                {trainer.mainSquadLocked ? (
                  <span className="rounded-sm border-2 border-frame bg-accent-2/25 px-3 py-2 font-display text-xs font-bold tracking-wide uppercase">
                    Main Squad locked
                  </span>
                ) : null}
                {isDemo ? (
                  <span className="rounded-sm border-2 border-frame bg-surface-2 px-3 py-2 font-display text-xs font-bold tracking-wide uppercase">
                    Demo example
                  </span>
                ) : null}
              </div>
              {isDemo ? (
                <p className="mt-3 text-sm text-muted">
                  This isn&apos;t a real player slot.{" "}
                  <Link
                    href={`/challenges/${challenge.slug}/join`}
                    className="font-bold text-accent-deep underline"
                  >
                    Sign in with Discord
                  </Link>{" "}
                  to get your own editable board.
                </p>
              ) : null}
            </div>
          </div>
        </Frame>

        <Frame title="Badge case">
          <BadgeCase
            badges={challenge.badges}
            earnedKeys={trainer.earnedBadgeKeys}
          />
        </Frame>

        <Frame title="Main Squad">
          <PartyStrip pokemon={main} slots={6} />
        </Frame>

        <Frame title="The Reserves">
          {reserves.length > 0 ? (
            <PartyStrip pokemon={reserves} />
          ) : (
            <p className="text-sm text-muted">No reserves logged yet.</p>
          )}
        </Frame>

        <Frame title="R.I.P." tone="rip">
          {graveyard.length > 0 ? (
            <PartyStrip pokemon={graveyard} memorial />
          ) : (
            <p className="text-sm text-muted">
              Memorial is empty. May it stay that way.
            </p>
          )}
        </Frame>

        {canEdit ? (
          <TrainerEditor
            trainer={trainer}
            badges={challenge.badges}
            canEdit={canEdit}
            isGm={Boolean(access?.isGm)}
          />
        ) : null}
      </main>
    </div>
  );
}
