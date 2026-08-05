import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ToolsView } from "@/components/ToolsView";
import {
  getChallenge,
  getChallengeMeta,
  getChallengeToolsSummary,
  getSeasonMemorialGraves,
} from "@/lib/challenges";
import { canViewCompetitiveDetails } from "@/lib/gm-lens";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { gravesPokemonByTrainerId } from "@/lib/memorial-backfill";
import { memorialSeasonHighlights } from "@/lib/memorial-stats";
import { getAccessForChallenge } from "@/lib/permissions";
import { redactTrainerCompetitiveDetails } from "@/lib/pokemon-privacy";
import {
  godCatchBoard,
  seasonCatchesByTrainer,
  shinySeasonBoard,
  type SeasonStatsData,
} from "@/lib/season-stats";
import {
  isLegacyCompareUrl,
  legacyCompareHref,
  parseBountyMode,
  parsePlannerMode,
  parsePokedexMode,
  parseToolsId,
  toolsTitle,
} from "@/lib/tools-routes";


type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    tool?: string;
    tab?: string;
    a?: string;
    b?: string;
    id?: string;
    chapter?: string;
    mode?: string;
  }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const [{ slug }, { tool, tab, a, b }] = await Promise.all([
    params,
    searchParams,
  ]);
  const challenge = await getChallengeMeta(slug);
  if (!challenge) return { title: "Tools" };

  // Metadata resolves before the page's redirect, so match the destination.
  const resolved = isLegacyCompareUrl({ a, b, tab, tool })
    ? "planner"
    : parseToolsId(tool, tab);
  if (!resolved) return { title: `Tools · ${challenge.name}` };
  return {
    title: `${toolsTitle(resolved)} · Tools · ${challenge.name}`,
  };
}

export default async function ToolsPage({ params, searchParams }: PageProps) {
  const [{ slug }, sp, session] = await Promise.all([
    params,
    searchParams,
    auth(),
  ]);
  const { tool, tab, a, b, id, mode } = sp;
  if (isLegacyCompareUrl({ a, b, tab, tool })) {
    redirect(legacyCompareHref(slug));
  }
  const challenge = await getChallengeToolsSummary(slug, session?.user?.id);
  if (!challenge) notFound();

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;
  // Speculative read — ignored when the viewer isn't a GM (avoids a second
  // round-trip after access resolves).
  const gmLensOn =
    access?.isGm === true ? await readGmLensOn(challenge.slug) : false;

  // One pass, two outputs: the redacted payload, and the ids whose competitive
  // fields survived it. Showcase needs the second to tell "IVs withheld from
  // you" apart from "this specimen has no IVs on file" — post-redaction both
  // look like `ivs: null`.
  const competitiveTrainerIds: string[] = [];
  const trainers = challenge.trainers.map((trainer) => {
    if (canViewCompetitiveDetails(access, trainer.userId, gmLensOn)) {
      competitiveTrainerIds.push(trainer.id);
      return trainer;
    }
    return redactTrainerCompetitiveDetails(trainer);
  });

  const myTrainerId =
    challenge.trainers.find((t) => t.userId === session?.user?.id)?.id ?? null;

  const initialTool = parseToolsId(tool, tab);
  const dexIdRaw = id != null ? Number(id) : NaN;
  const initialDexId =
    Number.isFinite(dexIdRaw) && dexIdRaw > 0 ? dexIdRaw : null;
  const initialBountyMode =
    initialTool === "bounty" ? parseBountyMode(mode) : null;
  const initialPlannerMode =
    initialTool === "planner" ? parsePlannerMode(mode) : null;
  const initialPokedexMode =
    initialTool === "pokedex" ? parsePokedexMode(mode) : null;

  // Season Stats needs data the tools payload doesn't carry: cross-run graves
  // (a wipe clears the live board) and unredacted IVs for the god-catch
  // board. Both are aggregated here so raw spreads never reach the client.
  let seasonStats: SeasonStatsData | null = null;
  if (initialTool === "stats") {
    // Full board rather than the tools summary: live rows need IVs for the
    // god-catch pass. Null on outage — the view shows "unavailable", never a
    // fabricated zero.
    const fullChallenge = await getChallenge(slug);
    const boardTrainers = fullChallenge?.trainers ?? challenge.trainers;
    const gravesPokemon = gravesPokemonByTrainerId(
      await getSeasonMemorialGraves(slug, boardTrainers),
    );
    const catches = seasonCatchesByTrainer(boardTrainers, gravesPokemon);
    seasonStats = {
      badgesTotal: challenge.badges.length,
      memorial: memorialSeasonHighlights(challenge.trainers, gravesPokemon),
      godCatches: fullChallenge
        ? godCatchBoard(fullChallenge.trainers, catches)
        : null,
      shinies: shinySeasonBoard(boardTrainers, catches),
    };
  }

  return (
    <Suspense
      fallback={<p className="text-sm text-muted">Loading tools…</p>}
    >
      <ToolsView
        slug={challenge.slug}
        challengeName={challenge.name}
        trainers={trainers}
        myTrainerId={myTrainerId}
        competitiveTrainerIds={competitiveTrainerIds}
        signedIn={Boolean(session?.user)}
        initialTool={initialTool}
        initialDexId={initialDexId}
        initialBountyMode={initialBountyMode}
        initialPlannerMode={initialPlannerMode}
        initialPokedexMode={initialPokedexMode}
        seasonStats={seasonStats}
      />
    </Suspense>
  );
}
