"use client";

import Link from "next/link";
import { useState } from "react";
import { EncounterLedger } from "@/components/EncounterLedger";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import type { EncounterRouteGroup } from "@/lib/encounter-ledger";
import type {
  EncounterRouteHighlight,
  EncounterSeasonHighlights,
  EncounterSpeciesHighlight,
} from "@/lib/encounter-stats";
import type { ModernEmeraldSpeciesRef } from "@/lib/modern-emerald-dex";
import { toolsHref } from "@/lib/tools-routes";

type EncounterSeasonViewProps = {
  slug: string;
  groups: EncounterRouteGroup[];
  highlights: EncounterSeasonHighlights;
  missing: ModernEmeraldSpeciesRef[];
};

export function EncounterSeasonView({
  slug,
  groups,
  highlights,
  missing,
}: EncounterSeasonViewProps) {
  const [showMissing, setShowMissing] = useState(false);
  const hasCallouts =
    highlights.mostLogged.length > 0 ||
    highlights.rarestSeen.length > 0 ||
    highlights.deadliestRoutes.length > 0;

  const mePct =
    highlights.meDexTotal > 0
      ? Math.round((highlights.meDexLogged / highlights.meDexTotal) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-tight text-accent-deep">
            Season route claims
          </p>
          <h2 className="text-2xl font-bold tracking-tight">Encounter ledger</h2>
          <p className="max-w-2xl text-sm text-muted">
            Catch routes from trainer boards. Zigzagoon skipped in popularity
            rankings.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatBlock
            value={String(highlights.totalLogged)}
            label="Logged"
            hint="All board rows"
          />
          <StatBlock
            value={String(highlights.uniqueSpecies)}
            label="Unique"
            hint="Distinct species"
          />
          <StatBlock
            value={`${highlights.meDexLogged}`}
            label="ME dex"
            hint={`${mePct}% of ${highlights.meDexTotal}`}
          />
          <StatBlock
            value={String(highlights.routesClaimed)}
            label="Routes"
            hint="With a claim"
          />
        </div>
      </header>

      {hasCallouts ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.mostLogged.length > 0 ? (
            <SpeciesTopCallout
              label="Most logged"
              entries={highlights.mostLogged}
              showCount
            />
          ) : null}
          {highlights.rarestSeen.length > 0 ? (
            <SpeciesTopCallout
              label="Rarest seen"
              entries={highlights.rarestSeen}
            />
          ) : null}
          {highlights.deadliestRoutes.length > 0 ? (
            <RouteTopCallout
              label="Deadliest routes"
              entries={highlights.deadliestRoutes}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={showMissing}
            onChange={(event) => setShowMissing(event.target.checked)}
            className="size-4 rounded border-frame accent-[var(--accent)]"
          />
          Show missing Modern Emerald dex
        </label>
        <Link
          href={toolsHref(slug, "bounty")}
          className="text-xs font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
        >
          Open Bounty Hunter
        </Link>
      </div>

      {showMissing ? (
        <MissingModernEmeraldGrid missing={missing} slug={slug} />
      ) : (
        <EncounterLedger slug={slug} groups={groups} />
      )}
    </div>
  );
}

function StatBlock({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint: string;
}) {
  return (
    <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
      <p className="font-display text-2xl font-bold tabular-nums leading-none tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="text-[10px] text-muted/80">{hint}</p>
    </div>
  );
}

function SpeciesTopCallout({
  label,
  entries,
  showCount = false,
}: {
  label: string;
  entries: EncounterSpeciesHighlight[];
  showCount?: boolean;
}) {
  return (
    <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
      <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
        {label}
      </p>
      <ol className="mt-2 space-y-1">
        {entries.map((entry) => (
          <li
            key={`${entry.species}-${entry.pokedexId ?? "x"}`}
            className="flex items-center gap-2"
          >
            <span className="relative inline-block h-10 w-10 shrink-0">
              <PokemonSpriteImage
                alt=""
                className="pixelated h-full w-full object-contain"
                height={40}
                pokedexId={entry.pokedexId}
                species={entry.species}
                width={40}
              />
            </span>
            <span className="min-w-0 truncate font-display text-sm font-bold leading-none">
              {showCount ? (
                <>
                  <span className="tabular-nums text-muted">{entry.count}</span>
                  {" "}
                  {entry.species}
                </>
              ) : (
                entry.species
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RouteTopCallout({
  label,
  entries,
}: {
  label: string;
  entries: EncounterRouteHighlight[];
}) {
  return (
    <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
      <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
        {label}
      </p>
      <ol className="mt-2 space-y-1.5">
        {entries.map((entry, index) => (
          <li
            key={entry.route}
            className="flex min-w-0 items-baseline gap-1.5 text-sm leading-none"
          >
            <span className="shrink-0 tabular-nums text-muted">
              {index + 1}
            </span>
            <span className="min-w-0 truncate font-display font-bold">
              {entry.route}
            </span>
            <span className="shrink-0 text-muted">·</span>
            <span className="shrink-0 tabular-nums text-muted">
              {entry.graveCount} fallen
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MissingModernEmeraldGrid({
  missing,
  slug,
}: {
  missing: ModernEmeraldSpeciesRef[];
  slug: string;
}) {
  if (missing.length === 0) {
    return (
      <div className="rounded-md border border-frame/40 bg-surface/60 px-4 py-5 text-sm text-muted">
        The pack has logged every Modern Emerald species. Absolute legends.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="text-xs text-muted">
        {missing.length} never logged.{" "}
        <Link
          href={toolsHref(slug, "bounty")}
          className="font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
        >
          Hunt in Bounty Hunter
        </Link>
      </p>
      <ul className="grid grid-cols-5 gap-1.5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-12">
        {missing.map((entry) => (
          <li key={entry.pokedexId}>
            <Link
              href={toolsHref(slug, "pokedex", { id: entry.pokedexId })}
              title={entry.species}
              className="pressable flex flex-col items-center gap-0.5 rounded-md border border-frame/30 bg-surface/50 px-1 py-1.5 hover:border-interactive/40 hover:bg-interactive-soft/40"
            >
              <PokemonSpriteImage
                alt=""
                className="pixelated h-10 w-10 object-contain"
                height={40}
                pokedexId={entry.pokedexId}
                species={entry.species}
                width={40}
              />
              <span className="text-[9px] font-semibold tabular-nums text-muted">
                #{String(entry.pokedexId).padStart(3, "0")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
