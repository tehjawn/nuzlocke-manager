import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ToolsView } from "@/components/ToolsView";
import {
  getChallengeMeta,
  getChallengeToolsSummary,
} from "@/lib/challenges";
import { canViewCompetitiveDetails } from "@/lib/gm-lens";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { getAccessForChallenge } from "@/lib/permissions";
import { toPublicTrainerPokemon } from "@/lib/pokemon-privacy";
import {
  isLegacyCompareUrl,
  legacyCompareHref,
  parseBountyMode,
  parsePlannerMode,
  parsePokedexMode,
  parseStatsSection,
  parseToolsId,
  seasonStatsHref,
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
    section?: string;
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
  if (isLegacyCompareUrl({ a, b, tab, tool })) {
    return { title: `Team Planner · Tools · ${challenge.name}` };
  }
  const resolved = parseToolsId(tool, tab);
  if (resolved === "stats") {
    return { title: `Season Stats · ${challenge.name}` };
  }
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
  const { tool, tab, a, b, id, mode, section } = sp;
  if (isLegacyCompareUrl({ a, b, tab, tool })) {
    redirect(legacyCompareHref(slug));
  }
  // Season Stats lives on the former Memorial tab (#288) — keep old Tools
  // deep links working.
  if (parseToolsId(tool, tab) === "stats") {
    redirect(seasonStatsHref(slug, { section: parseStatsSection(section) }));
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

  // One pass, two outputs: the public payload, and the ids whose competitive
  // fields survived it. Catch / bond tiers are stamped on during redaction and
  // stay public; the ids gate the raw spreads in the details modal.
  const competitiveTrainerIds: string[] = [];
  const trainers = challenge.trainers.map((trainer) => {
    if (canViewCompetitiveDetails(access, trainer.userId, gmLensOn)) {
      competitiveTrainerIds.push(trainer.id);
      return trainer;
    }
    return toPublicTrainerPokemon(trainer);
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
        survivalMarketsEnabled={challenge.survivalMarketsEnabled !== false}
        viewerUserId={session?.user?.id ?? null}
        initialTool={initialTool}
        initialDexId={initialDexId}
        initialBountyMode={initialBountyMode}
        initialPlannerMode={initialPlannerMode}
        initialPokedexMode={initialPokedexMode}
      />
    </Suspense>
  );
}
