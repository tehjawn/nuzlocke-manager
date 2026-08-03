"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { BountyHunterView } from "@/components/BountyHunterView";
import { Frame } from "@/components/Frame";
import { GameGuidePanel } from "@/components/GameGuidePanel";
import { GuideIcon } from "@/components/nav-icons";
import { PokedexPanel } from "@/components/PokedexPanel";
import { TeamPlannerView } from "@/components/TeamPlannerView";
import { TrainerCompare } from "@/components/TrainerCompare";
import { TypeChartPanel } from "@/components/TypeChartPanel";
import type {
  BadgeDefinition,
  TrainerProfile,
} from "@/lib/challenge-types";
import {
  parseToolsId,
  TOOLS_CATALOG,
  toolsHref,
  toolsHubHref,
  type BountyMode,
  type PlannerMode,
  type ToolsId,
} from "@/lib/tools-routes";

type ToolsViewProps = {
  slug: string;
  challengeName: string;
  trainers: TrainerProfile[];
  badges: BadgeDefinition[];
  /** Signed-in trainer id for this season (Type Tips / ownership). */
  myTrainerId?: string | null;
  signedIn?: boolean;
  /** When null, show the Tools directory hub. */
  initialTool?: ToolsId | null;
  initialCompareA?: string | null;
  initialCompareB?: string | null;
  initialDexId?: number | null;
  initialBountyMode?: BountyMode | null;
  initialPlannerMode?: PlannerMode | null;
};

export function ToolsView({
  slug,
  challengeName,
  trainers,
  badges,
  myTrainerId = null,
  signedIn = false,
  initialTool = null,
  initialCompareA = null,
  initialCompareB = null,
  initialDexId = null,
  initialBountyMode = null,
  initialPlannerMode = null,
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
      badges={badges}
      myTrainerId={myTrainerId}
      signedIn={signedIn}
      initialCompareA={initialCompareA}
      initialCompareB={initialCompareB}
      initialDexId={initialDexId}
      initialBountyMode={initialBountyMode}
      initialPlannerMode={initialPlannerMode}
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
                    {toolIcon(entry.id)}
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

function toolIcon(id: ToolsId): ReactNode {
  switch (id) {
    case "pokedex":
      return <PokedexToolIcon />;
    case "chart":
      return <TypeChartToolIcon />;
    case "compare":
      return <CompareToolIcon />;
    case "guide":
      return <GuideIcon className="h-5 w-5" />;
    case "bounty":
      return <BountyToolIcon />;
    case "planner":
      return <PlannerToolIcon />;
  }
}

function PokedexToolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <circle cx="12" cy="11" r="3.25" />
      <path d="M9.5 17.5h5" strokeLinecap="round" />
    </svg>
  );
}

function TypeChartToolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
    </svg>
  );
}

function CompareToolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <path d="M3.5 19c.7-2.6 2.7-4 4.5-4s3.8 1.4 4.5 4" strokeLinecap="round" />
      <path d="M11.5 19c.7-2.6 2.7-4 4.5-4s3.8 1.4 4.5 4" strokeLinecap="round" />
    </svg>
  );
}

function BountyToolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <circle cx="12" cy="12" r="7.25" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.75v2.5M12 18.75v2.5M2.75 12h2.5M18.75 12h2.5" strokeLinecap="round" />
    </svg>
  );
}

function PlannerToolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9.5h8M8 12.5h5M8 15.5h6" strokeLinecap="round" />
      <circle cx="16.5" cy="15.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ToolWorkspace({
  slug,
  challengeName,
  tool,
  trainers,
  badges,
  myTrainerId,
  signedIn,
  initialCompareA,
  initialCompareB,
  initialDexId,
  initialBountyMode,
  initialPlannerMode,
}: {
  slug: string;
  challengeName: string;
  tool: ToolsId;
  trainers: TrainerProfile[];
  badges: BadgeDefinition[];
  myTrainerId?: string | null;
  signedIn?: boolean;
  initialCompareA?: string | null;
  initialCompareB?: string | null;
  initialDexId?: number | null;
  initialBountyMode?: BountyMode | null;
  initialPlannerMode?: PlannerMode | null;
}) {
  const meta = TOOLS_CATALOG.find((t) => t.id === tool)!;
  const hubHref = toolsHubHref(slug);

  const blurb =
    tool === "pokedex"
      ? `Look up species for ${challengeName} — stats, matchups, and counters from your Main + Reserve.`
      : tool === "chart"
        ? `Modern 18-type chart first — pick a trainer below it to score Main Squad coverage.`
        : tool === "guide"
          ? `What to do next in the story for ${challengeName}.`
          : tool === "bounty"
            ? `Open bounties, personal gaps, and pack exclusives for ${challengeName}.`
            : tool === "planner"
              ? `Draft a Main of 6 and check coverage, defensive holes, and League prep for ${challengeName}.`
              : `Side-by-side squads and badges for ${challengeName}.`;

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

      {tool === "compare" ? (
        <TrainerCompare
          slug={slug}
          trainers={trainers}
          badges={badges}
          initialA={initialCompareA}
          initialB={initialCompareB}
        />
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
