"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BountyHunterView } from "@/components/BountyHunterView";
import { Frame } from "@/components/Frame";
import { GameGuidePanel } from "@/components/GameGuidePanel";
import { PokedexPanel } from "@/components/PokedexPanel";
import { TeamPlannerView } from "@/components/TeamPlannerView";
import { ToolIcon } from "@/components/tool-icons";
import { TypeChartPanel } from "@/components/TypeChartPanel";
import type { TrainerProfile } from "@/lib/challenge-types";
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
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-[var(--on-chrome)]/80" aria-hidden>
                    <ToolIcon id={entry.id} />
                  </span>
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
}) {
  const meta = TOOLS_CATALOG.find((t) => t.id === tool)!;
  const hubHref = toolsHubHref(slug);

  const blurb =
    tool === "pokedex"
      ? `Look up species for ${challengeName} — role, F→S BST ranks, competitive viability, matchups, and who's already caught it.`
      : tool === "chart"
        ? `Modern 18-type chart first — pick a trainer below it to score Main Squad coverage.`
        : tool === "guide"
          ? `What to do next in the story for ${challengeName}.`
          : tool === "bounty"
            ? `Who owns, who's seen, who's cornered a whole line — and every Pokémon on a board — in ${challengeName}.`
            : `Draft a Main of 6 and check coverage, defensive holes, and League prep for ${challengeName}.`;

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
          <h2 className="text-2xl font-bold tracking-tight">{meta.title}</h2>
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
    </div>
  );
}
