"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BountyHunterView } from "@/components/BountyHunterView";
import { Frame } from "@/components/Frame";
import { GameGuidePanel } from "@/components/GameGuidePanel";
import { PokedexPanel } from "@/components/PokedexPanel";
import { SeasonStatsView } from "@/components/SeasonStatsView";
import { TeamPlannerView } from "@/components/TeamPlannerView";
import { ToolChip, TOOL_TONE_CHIP, toolsTone } from "@/components/tool-icons";
import { TypeChartPanel } from "@/components/TypeChartPanel";
import type { TrainerProfile } from "@/lib/challenge-types";
import type { SeasonStatsData } from "@/lib/season-stats";
import {
  parseToolsId,
  TOOLS_CATALOG,
  toolsHref,
  toolsHubHref,
  type BountyMode,
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
   * Showcase reads it to label withheld catch tiers honestly.
   */
  competitiveTrainerIds?: string[];
  signedIn?: boolean;
  /** When null, show the Tools directory hub. */
  initialTool?: ToolsId | null;
  initialDexId?: number | null;
  initialBountyMode?: BountyMode | null;
  initialPlannerMode?: PlannerMode | null;
  initialPokedexMode?: PokedexMode | null;
  /** Season Stats extras, server-computed only when that tool is open. */
  seasonStats?: SeasonStatsData | null;
};

export function ToolsView({
  slug,
  challengeName,
  trainers,
  myTrainerId = null,
  competitiveTrainerIds,
  signedIn = false,
  initialTool = null,
  initialDexId = null,
  initialBountyMode = null,
  initialPlannerMode = null,
  initialPokedexMode = null,
  seasonStats = null,
}: ToolsViewProps) {
  const searchParams = useSearchParams();
  const tool =
    parseToolsId(searchParams.get("tool"), searchParams.get("tab")) ??
    initialTool;

  if (!tool) {
    return (
      <ToolsDirectory slug={slug} challengeName={challengeName} />
    );
  }

  return (
    <ToolWorkspace
      slug={slug}
      challengeName={challengeName}
      tool={tool}
      trainers={trainers}
      myTrainerId={myTrainerId}
      competitiveTrainerIds={competitiveTrainerIds}
      signedIn={signedIn}
      initialDexId={initialDexId}
      initialBountyMode={initialBountyMode}
      initialPlannerMode={initialPlannerMode}
      initialPokedexMode={initialPokedexMode}
      seasonStats={seasonStats}
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

/** Exhaustive by construction — a new ToolsId fails to compile until added. */
const TOOL_BLURBS: Record<ToolsId, (challengeName: string) => string> = {
  guide: (name) => `What to do next in the story for ${name}.`,
  pokedex: (name) =>
    `Look up species for ${name} — role, F→S BST ranks, competitive viability, matchups, and who's already caught it.`,
  bounty: (name) =>
    `Who owns, who's seen, who's cornered a whole line — and every Pokémon on a board — in ${name}.`,
  planner: (name) =>
    `Draft a Main of 6 and check coverage, defensive holes, and League prep for ${name}.`,
  stats: (name) =>
    `Who's winning ${name} — badge race, wallets, god catches, shinies, and the season's records.`,
  chart: () =>
    "Modern 18-type chart first — pick a trainer below it to score Main Squad coverage.",
};

function ToolWorkspace({
  slug,
  challengeName,
  tool,
  trainers,
  myTrainerId,
  competitiveTrainerIds,
  signedIn,
  initialDexId,
  initialBountyMode,
  initialPlannerMode,
  initialPokedexMode,
  seasonStats,
}: {
  slug: string;
  challengeName: string;
  tool: ToolsId;
  trainers: TrainerProfile[];
  myTrainerId?: string | null;
  competitiveTrainerIds?: string[];
  signedIn?: boolean;
  initialDexId?: number | null;
  initialBountyMode?: BountyMode | null;
  initialPlannerMode?: PlannerMode | null;
  initialPokedexMode?: PokedexMode | null;
  seasonStats?: SeasonStatsData | null;
}) {
  const meta = TOOLS_CATALOG.find((t) => t.id === tool)!;
  const hubHref = toolsHubHref(slug);
  const tone = toolsTone(tool);
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
              <h2 className="text-2xl font-bold tracking-tight">{meta.title}</h2>
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

      {tool === "pokedex" ? (
        <PokedexPanel
          slug={slug}
          trainers={trainers}
          myTrainerId={myTrainerId}
          signedIn={signedIn}
          initialId={initialDexId}
          initialMode={initialPokedexMode}
        />
      ) : null}

      {tool === "chart" ? (
        <Frame>
          <TypeChartPanel
            slug={slug}
            trainers={trainers}
            myTrainerId={myTrainerId}
          />
        </Frame>
      ) : null}

      {tool === "guide" ? (
        <GameGuidePanel
          slug={slug}
          trainers={trainers}
          myTrainerId={myTrainerId}
        />
      ) : null}

      {tool === "bounty" ? (
        <BountyHunterView
          slug={slug}
          trainers={trainers}
          myTrainerId={myTrainerId}
          competitiveTrainerIds={competitiveTrainerIds}
          initialMode={initialBountyMode}
        />
      ) : null}

      {tool === "planner" ? (
        <TeamPlannerView
          slug={slug}
          trainers={trainers}
          myTrainerId={myTrainerId}
          initialMode={initialPlannerMode}
        />
      ) : null}

      {tool === "stats" ? (
        <SeasonStatsView
          slug={slug}
          trainers={trainers}
          myTrainerId={myTrainerId}
          seasonStats={seasonStats}
        />
      ) : null}
    </div>
  );
}
