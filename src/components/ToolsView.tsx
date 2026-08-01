"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Frame } from "@/components/Frame";
import { GameGuidePanel } from "@/components/GameGuidePanel";
import { PokedexPanel } from "@/components/PokedexPanel";
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

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS_CATALOG.map((entry) => (
          <li key={entry.id}>
            <Link
              href={toolsHref(slug, entry.id)}
              className="pressable gba-frame group flex h-full flex-col overflow-hidden text-left transition-colors"
            >
              <span className="gba-frame-title relative z-[1] flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold sm:text-base">
                <span className="min-w-0 truncate">{entry.title}</span>
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
  badges,
  myTrainerId,
  signedIn,
  initialCompareA,
  initialCompareB,
  initialDexId,
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
}) {
  const meta = TOOLS_CATALOG.find((t) => t.id === tool)!;
  const hubHref = toolsHubHref(slug);

  const blurb =
    tool === "pokedex"
      ? `Look up species for ${challengeName} — stats, matchups, and counters from your Main + Reserve.`
      : tool === "chart"
        ? `Attack × defense multipliers for ${challengeName}.`
        : tool === "guide"
          ? `What to do next in the story for ${challengeName}.`
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
          <p className="mt-2 text-muted">{blurb}</p>
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
          <TypeChartPanel />
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
    </div>
  );
}
