import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { MemorialBoard } from "@/components/MemorialBoard";
import { SeasonStatsView } from "@/components/SeasonStatsView";
import { SeasonStatusBanner } from "@/components/SeasonStatusBanner";
import {
  getChallenge,
  getChallengeMeta,
  getSeasonMemorialGraves,
} from "@/lib/challenges";
import { canEditTrainerBoard, canViewCompetitiveDetails } from "@/lib/gm-lens";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { gravesPokemonByTrainerId } from "@/lib/memorial-backfill";
import { memorialSeasonHighlights } from "@/lib/memorial-stats";
import { getAccessForChallenge } from "@/lib/permissions";
import { redactTrainerCompetitiveDetails } from "@/lib/pokemon-privacy";
import { isSeasonReadOnly } from "@/lib/season-status";
import {
  godCatchBoard,
  seasonCatchesByTrainer,
  shinySeasonBoard,
  type SeasonStatsData,
} from "@/lib/season-stats";


type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallengeMeta(slug);
  if (!challenge) return { title: "Season Stats" };
  return { title: `Season Stats · ${challenge.name}` };
}

/**
 * Canonical Season Stats home (issue #288) — hall-of-fame leaderboards plus
 * the cross-run grave browser. Lives at `/season-stats`; `/memorial` redirects
 * here for old bookmarks.
 */
export default async function SeasonStatsPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallenge(slug, session?.user?.id);
  if (!challenge) notFound();

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;
  const gmLensOn = access?.isGm
    ? await readGmLensOn(challenge.slug)
    : false;
  const seasonReadOnly = isSeasonReadOnly(challenge.status);

  // Display trainers are redacted; god-catch / shiny boards stay server-side
  // on the unredacted payload so raw IVs never reach the client.
  const trainers = challenge.trainers.map((trainer) => {
    if (canViewCompetitiveDetails(access, trainer.userId, gmLensOn)) {
      return trainer;
    }
    return redactTrainerCompetitiveDetails(trainer);
  });

  const gravesByTrainerId = await getSeasonMemorialGraves(
    challenge.slug,
    challenge.trainers,
  );
  const gravesPokemon = gravesPokemonByTrainerId(gravesByTrainerId);
  const catches = seasonCatchesByTrainer(challenge.trainers, gravesPokemon);
  const seasonStats: SeasonStatsData = {
    badgesTotal: challenge.badges.length,
    memorial: memorialSeasonHighlights(challenge.trainers, gravesPokemon),
    godCatches: godCatchBoard(challenge.trainers, catches),
    shinies: shinySeasonBoard(challenge.trainers, catches),
  };

  const editableTrainerIds = challenge.trainers
    .filter((trainer) =>
      canEditTrainerBoard(
        access,
        trainer.userId,
        gmLensOn,
        seasonReadOnly,
      ),
    )
    .map((trainer) => trainer.id);

  const myTrainerId =
    challenge.trainers.find((t) => t.userId === session?.user?.id)?.id ?? null;

  return (
    <>
      <DataSourceBanner source={challenge.source} />
      <div className="mb-4">
        <SeasonStatusBanner
          slug={challenge.slug}
          status={challenge.status}
          isGm={Boolean(access?.isGm)}
        />
      </div>
      <div className="space-y-6">
        <header className="space-y-1.5">
          <p className="text-xs font-semibold tracking-tight text-accent-deep">
            Hall of fame
          </p>
          <h2 className="text-2xl font-bold tracking-tight">Season Stats</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            Leaderboards, catch quality, and every fallen partner from{" "}
            {challenge.name}
            {challenge.status === "ARCHIVED"
              ? " — season archived and read-only"
              : ""}
            .
          </p>
        </header>
        <Suspense
          fallback={<p className="text-sm text-muted">Loading season stats…</p>}
        >
          <SeasonStatsView
            slug={challenge.slug}
            trainers={trainers}
            myTrainerId={myTrainerId}
            seasonStats={seasonStats}
            memorialBrowser={
              <MemorialBoard
                slug={challenge.slug}
                trainers={trainers}
                editableTrainerIds={editableTrainerIds}
                gravesByTrainerId={gravesByTrainerId}
              />
            }
          />
        </Suspense>
      </div>
    </>
  );
}
