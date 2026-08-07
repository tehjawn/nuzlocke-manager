"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchToolsPokemonHydrateAction } from "@/app/actions/tools-pokemon";
import { BountyHunterView } from "@/components/BountyHunterView";
import { Frame } from "@/components/Frame";
import { GameGuidePanel } from "@/components/GameGuidePanel";
import { ItemDexPanel } from "@/components/ItemDexPanel";
import { PokedexPanel } from "@/components/PokedexPanel";
import { SurvivalMarketsPanel } from "@/components/SurvivalMarketsPanel";
import { TeamPlannerView } from "@/components/TeamPlannerView";
import { ToolChip, TOOL_TONE_CHIP, toolsTone } from "@/components/tool-icons";
import { TypeChartPanel } from "@/components/TypeChartPanel";
import type { ItemLens } from "@/data/items";
import type { TrainerProfile } from "@/lib/challenge-types";
import type { SurvivalMarketListItem } from "@/lib/survival-market-types";
import {
  mergeToolsPokemonHydrate,
  toolsHydrateKindFor,
} from "@/lib/tools-pokemon-hydrate";
import { useToolsEncounteredStubs } from "@/lib/use-tools-encountered-stubs";
import {
  parseToolsId,
  TOOLS_CATALOG,
  toolsHref,
  toolsHubHref,
  type BountyMode,
  type MarketsMode,
  type MarketsSort,
  type PlannerMode,
  type PokedexMode,
  type ToolsId,
} from "@/lib/tools-routes";

type ToolsViewProps = {
  slug: string;
  challengeName: string;
  trainers: TrainerProfile[];
  /** Signed-in trainer id for this season (Type Tips / ownership). */
  myTrainerId?: string | null;
  /**
   * Trainers whose competitive fields survived redaction for this viewer.
   * Gates raw spreads in the Showcase details modal; tier chrome is public.
   * SSR starts empty — hydrate / per-entry fetch fills this when needed (#367).
   */
  competitiveTrainerIds?: string[];
  signedIn?: boolean;
  /** Survive/Die season flag — Tools markets panel respects it. */
  survivalMarketsEnabled?: boolean;
  viewerUserId?: string | null;
  /** When null, show the Tools directory hub. */
  initialTool?: ToolsId | null;
  initialDexId?: number | null;
  initialBountyMode?: BountyMode | null;
  initialPlannerMode?: PlannerMode | null;
  initialPokedexMode?: PokedexMode | null;
  initialMarketsMode?: MarketsMode | null;
  initialMarketsSort?: MarketsSort | null;
  /** SSR Survive/Die markets when `?tool=markets` (#366). */
  initialMarkets?: SurvivalMarketListItem[] | null;
  initialItemSlug?: string | null;
  initialItemLens?: ItemLens | null;
};

export function ToolsView({
  slug,
  challengeName,
  trainers,
  myTrainerId = null,
  competitiveTrainerIds,
  signedIn = false,
  survivalMarketsEnabled = true,
  viewerUserId = null,
  initialTool = null,
  initialDexId = null,
  initialBountyMode = null,
  initialPlannerMode = null,
  initialPokedexMode = null,
  initialMarketsMode = null,
  initialMarketsSort = null,
  initialMarkets = null,
  initialItemSlug = null,
  initialItemLens = null,
}: ToolsViewProps) {
  const searchParams = useSearchParams();
  const tool =
    parseToolsId(searchParams.get("tool"), searchParams.get("tab")) ??
    initialTool;

  // Season Stats redirects server-side (#288); never render it inside Tools.
  if (!tool || tool === "stats") {
    return <ToolsDirectory slug={slug} challengeName={challengeName} />;
  }

  return (
    <ToolWorkspace
      key={tool}
      slug={slug}
      challengeName={challengeName}
      tool={tool}
      trainers={trainers}
      myTrainerId={myTrainerId}
      competitiveTrainerIds={competitiveTrainerIds}
      signedIn={signedIn}
      survivalMarketsEnabled={survivalMarketsEnabled}
      viewerUserId={viewerUserId}
      initialDexId={initialDexId}
      initialBountyMode={initialBountyMode}
      initialPlannerMode={initialPlannerMode}
      initialPokedexMode={initialPokedexMode}
      initialMarketsMode={initialMarketsMode}
      initialMarketsSort={initialMarketsSort}
      initialMarkets={initialMarkets}
      initialItemSlug={initialItemSlug}
      initialItemLens={initialItemLens}
    />
  );
}

function ToolsDirectory({
  slug,
  challengeName,
}: {
  slug: string;
  challengeName: string;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Tools</h2>
        <p className="mt-2 text-muted">
          Quick references for {challengeName}. Pick a tool to open it.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TOOLS_CATALOG.map((entry) => (
          <li key={entry.id}>
            <Link
              href={toolsHref(slug, entry.id)}
              className="pressable gba-frame group flex h-full flex-col overflow-hidden text-left transition-colors"
            >
              <span className="gba-frame-title relative z-[1] flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold sm:text-base">
                <span className="flex min-w-0 items-center gap-2.5">
                  <ToolChip
                    id={entry.id}
                    className="h-8 w-8"
                    iconClassName="h-4 w-4"
                  />
                  <span className="min-w-0 truncate">{entry.title}</span>
                </span>
                <span
                  aria-hidden
                  className="shrink-0 text-sm text-[var(--on-chrome)]/70 transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </span>
              <span className="relative z-[1] flex flex-1 flex-col p-4 sm:p-5">
                <span
                  className={`mb-2 inline-flex w-fit rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-tight ${TOOL_TONE_CHIP[entry.tone]}`}
                >
                  {entry.navLabel}
                </span>
                <span className="text-sm leading-relaxed text-muted">
                  {entry.blurb}
                </span>
                <span className="mt-4 text-xs font-semibold tracking-tight text-interactive">
                  Open {entry.title}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

type WorkspaceTool = Exclude<ToolsId, "stats">;

/** Exhaustive by construction — a new ToolsId fails to compile until added. */
const TOOL_BLURBS: Record<WorkspaceTool, (challengeName: string) => string> = {
  guide: (name) => `What to do next in the story for ${name}.`,
  pokedex: (name) =>
    `Look up species for ${name} — role, F→S BST ranks, competitive viability, matchups, and who's already caught it.`,
  itemdex: () =>
    "What an item does and every place Modern Emerald puts one — balls, hidden squares, shops, and the wild mons that hold it.",
  bounty: (name) =>
    `Who owns, who's seen, who's cornered a whole line — and every Pokémon on a board — in ${name}.`,
  markets: (name) =>
    `Will they make it in ${name}? Weigh in on active-run mons, then see who called it when they fall or clear.`,
  planner: (name) =>
    `Draft a Main of 6 and check coverage, defensive holes, and League prep for ${name}.`,
  chart: () =>
    "Modern 18-type chart first — pick a trainer below it to score Main Squad coverage.",
};

function ToolWorkspace({
  slug,
  challengeName,
  tool,
  trainers: summaryTrainers,
  myTrainerId,
  competitiveTrainerIds: initialCompetitiveIds,
  signedIn,
  survivalMarketsEnabled,
  viewerUserId,
  initialDexId,
  initialBountyMode,
  initialPlannerMode,
  initialPokedexMode,
  initialMarketsMode,
  initialMarketsSort,
  initialMarkets = null,
  initialItemSlug,
  initialItemLens,
}: {
  slug: string;
  challengeName: string;
  tool: WorkspaceTool;
  trainers: TrainerProfile[];
  myTrainerId?: string | null;
  competitiveTrainerIds?: string[];
  signedIn?: boolean;
  survivalMarketsEnabled?: boolean;
  viewerUserId?: string | null;
  initialDexId?: number | null;
  initialBountyMode?: BountyMode | null;
  initialPlannerMode?: PlannerMode | null;
  initialPokedexMode?: PokedexMode | null;
  initialMarketsMode?: MarketsMode | null;
  initialMarketsSort?: MarketsSort | null;
  initialMarkets?: SurvivalMarketListItem[] | null;
  initialItemSlug?: string | null;
  initialItemLens?: ItemLens | null;
}) {
  const meta = TOOLS_CATALOG.find((t) => t.id === tool)!;
  const hubHref = toolsHubHref(slug);
  const tone = toolsTone(tool);

  const [trainers, setTrainers] = useState(summaryTrainers);
  const [competitiveTrainerIds, setCompetitiveTrainerIds] = useState(
    initialCompetitiveIds ?? [],
  );
  const [gradesReady, setGradesReady] = useState(
    () => toolsHydrateKindFor(tool) !== "grades",
  );
  const seen = useToolsEncounteredStubs(slug, tool === "pokedex");
  const pokedexTrainers = seen.withStubs(trainers);

  // Pay for grades / moves only when the open tool needs them (#367).
  // `key={tool}` remounts this workspace on tool switches, so hydrate state
  // starts fresh without a props→state sync effect.
  useEffect(() => {
    const kind = toolsHydrateKindFor(tool);
    if (!kind) return;

    let cancelled = false;
    const trainerIds =
      kind === "moves" && tool === "pokedex" && myTrainerId
        ? [myTrainerId]
        : undefined;

    void (async () => {
      const result = await fetchToolsPokemonHydrateAction({
        slug,
        kind,
        trainerIds,
      });
      if (cancelled || !result.ok) {
        if (!cancelled && kind === "grades") setGradesReady(true);
        return;
      }
      const merged = mergeToolsPokemonHydrate(summaryTrainers, result);
      if (cancelled) return;
      setTrainers(merged.trainers);
      if (result.competitiveTrainerIds.length > 0) {
        setCompetitiveTrainerIds(result.competitiveTrainerIds);
      }
      if (kind === "grades") setGradesReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [tool, slug, myTrainerId, summaryTrainers]);

  // Survive/Die owns its header so Vote now can sit opposite the title.
  if (tool === "markets") {
    return (
      <SurvivalMarketsPanel
        slug={slug}
        trainers={trainers}
        enabled={survivalMarketsEnabled !== false}
        viewerUserId={viewerUserId}
        initialMode={initialMarketsMode}
        initialSort={initialMarketsSort}
        initialMarkets={initialMarkets}
        pageHeader={{
          hubHref,
          title: meta.title,
          navLabel: meta.navLabel,
          tone,
        }}
      />
    );
  }

  const blurb = TOOL_BLURBS[tool](challengeName);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link
          href={hubHref}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
        >
          <span aria-hidden>←</span>
          All tools
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <ToolChip
              id={tool}
              className="h-9 w-9"
              iconClassName="h-[1.125rem] w-[1.125rem]"
            />
            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight">
                {meta.title}
              </h2>
              <p
                className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-tight ${TOOL_TONE_CHIP[tone]}`}
              >
                {meta.navLabel}
              </p>
            </div>
          </div>
          <p className="mt-2 text-base text-muted">{blurb}</p>
        </div>
      </header>

      {tool === "pokedex" && (
        <PokedexPanel
          slug={slug}
          trainers={pokedexTrainers}
          myTrainerId={myTrainerId}
          signedIn={signedIn}
          initialId={initialDexId}
          initialMode={initialPokedexMode}
        />
      )}

      {tool === "itemdex" && (
        <ItemDexPanel
          slug={slug}
          initialItem={initialItemSlug}
          initialLens={initialItemLens}
        />
      )}

      {tool === "chart" && (
        <Frame>
          <TypeChartPanel
            slug={slug}
            trainers={trainers}
            myTrainerId={myTrainerId}
          />
        </Frame>
      )}

      {tool === "guide" && (
        <GameGuidePanel
          slug={slug}
          trainers={trainers}
          myTrainerId={myTrainerId}
        />
      )}

      {tool === "bounty" && (
        <BountyHunterView
          slug={slug}
          trainers={trainers}
          myTrainerId={myTrainerId}
          competitiveTrainerIds={competitiveTrainerIds}
          gradesReady={gradesReady}
          initialMode={initialBountyMode}
        />
      )}

      {tool === "planner" && (
        <TeamPlannerView
          slug={slug}
          trainers={trainers}
          myTrainerId={myTrainerId}
          initialMode={initialPlannerMode}
        />
      )}
    </div>
  );
}
