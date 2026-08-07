import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ToolsView } from "@/components/ToolsView";
import {
  getChallengeMeta,
  getChallengeToolsSummary,
} from "@/lib/challenges";
import { itemDexSlug } from "@/data/item-links";
import { parseItemLens } from "@/data/items";
import {
  isLegacyCompareUrl,
  legacyCompareHref,
  parseBountyMode,
  parseMarketsMode,
  parseMarketsSort,
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
    sort?: string;
    section?: string;
    item?: string;
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
  const { tool, tab, a, b, id, mode, section, sort, item } = sp;
  if (isLegacyCompareUrl({ a, b, tab, tool })) {
    redirect(legacyCompareHref(slug));
  }
  // Season Stats lives on the former Memorial tab (#288) — keep old Tools
  // deep links working.
  const initialTool = parseToolsId(tool, tab);
  if (initialTool === "stats") {
    redirect(seasonStatsHref(slug, { section: parseStatsSection(section) }));
  }

  // Shared summary board for every tool URL (#367). Grades / moves / spreads
  // hydrate client-side when Ownership, Planner, Pokédex, or Guide mounts.
  const challenge = await getChallengeToolsSummary(slug, session?.user?.id);
  if (!challenge) notFound();

  const myTrainerId =
    challenge.trainers.find((t) => t.userId === session?.user?.id)?.id ?? null;
  const dexIdRaw = id != null ? Number(id) : NaN;
  const initialDexId =
    Number.isFinite(dexIdRaw) && dexIdRaw > 0 ? dexIdRaw : null;
  const initialBountyMode =
    initialTool === "bounty" ? parseBountyMode(mode) : null;
  const initialPlannerMode =
    initialTool === "planner" ? parsePlannerMode(mode) : null;
  const initialPokedexMode =
    initialTool === "pokedex" ? parsePokedexMode(mode) : null;
  const initialMarketsMode =
    initialTool === "markets" ? parseMarketsMode(mode) : null;
  const initialMarketsSort =
    initialTool === "markets"
      ? parseMarketsSort(sort, parseMarketsMode(mode))
      : null;
  // Resolve through the catalog so `?item=` accepts a display name as well as
  // a slug, and an unknown value falls back to the panel's default entry.
  const initialItemSlug =
    initialTool === "itemdex" ? itemDexSlug(item) : null;
  const initialItemLens =
    initialTool === "itemdex" ? parseItemLens(mode) : null;

  return (
    <Suspense
      fallback={<p className="text-sm text-muted">Loading tools…</p>}
    >
      <ToolsView
        slug={challenge.slug}
        challengeName={challenge.name}
        trainers={challenge.trainers}
        myTrainerId={myTrainerId}
        competitiveTrainerIds={[]}
        signedIn={Boolean(session?.user)}
        survivalMarketsEnabled={challenge.survivalMarketsEnabled !== false}
        viewerUserId={session?.user?.id ?? null}
        initialTool={initialTool}
        initialDexId={initialDexId}
        initialBountyMode={initialBountyMode}
        initialPlannerMode={initialPlannerMode}
        initialPokedexMode={initialPokedexMode}
        initialMarketsMode={initialMarketsMode}
        initialMarketsSort={initialMarketsSort}
        initialItemSlug={initialItemSlug}
        initialItemLens={initialItemLens}
      />
    </Suspense>
  );
}
