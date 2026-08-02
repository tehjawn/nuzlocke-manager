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

  return (
    <div className="space-y-5">
      <header className="space-y-1.5">
        <p className="text-xs font-semibold tracking-tight text-accent-deep">
          Season route claims
        </p>
        <h2 className="text-2xl font-bold tracking-tight">Encounter ledger</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Light route claims from catch routes on trainer boards — not a full
          encounter tracker. Stats reflect currently logged board state
          (Zigzagoon skipped in popularity rankings).
        </p>
        <p className="text-xs text-muted">
          {highlights.totalLogged} logged · {highlights.uniqueSpecies} unique
          species · {highlights.meDexLogged} / {highlights.meDexTotal} ME dex ·{" "}
          {highlights.routesClaimed} route
          {highlights.routesClaimed === 1 ? "" : "s"} claimed
        </p>
      </header>

      {hasCallouts ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.mostLogged.length > 0 ? (
            <SpeciesTopCallout
              label="Most logged"
              entries={highlights.mostLogged}
              countLabel={(n) => `${n} on boards`}
            />
          ) : null}
          {highlights.rarestSeen.length > 0 ? (
            <SpeciesTopCallout
              label="Rarest seen"
              entries={highlights.rarestSeen}
              countLabel={(n) => `${n} on boards`}
            />
          ) : null}
          {highlights.deadliestRoutes.length > 0 ? (
            <RouteTopCallout
              label="Deadliest catch routes"
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

function SpeciesTopCallout({
  label,
  entries,
  countLabel,
}: {
  label: string;
  entries: EncounterSpeciesHighlight[];
  countLabel: (count: number) => string;
}) {
  return (
    <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
      <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
        {label}
      </p>
      <ol className="mt-1.5 space-y-1">
        {entries.map((entry, index) => (
          <li
            key={`${entry.species}-${entry.pokedexId ?? "x"}`}
            className="flex items-center gap-2"
          >
            <span className="w-3 shrink-0 text-[10px] font-bold tabular-nums text-muted">
              {index + 1}
            </span>
            <span className="relative inline-block h-7 w-7 shrink-0">
              <PokemonSpriteImage
                alt=""
                className="pixelated h-full w-full object-contain"
                height={28}
                pokedexId={entry.pokedexId}
                species={entry.species}
                width={28}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-xs font-bold leading-tight">
                {entry.species}
              </span>
              <span className="text-[10px] text-muted">
                {countLabel(entry.count)}
              </span>
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
      <ol className="mt-1.5 space-y-1.5">
        {entries.map((entry, index) => (
          <li key={entry.route} className="flex items-start gap-2">
            <span className="w-3 shrink-0 pt-0.5 text-[10px] font-bold tabular-nums text-muted">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-xs font-bold leading-tight">
                {entry.route}
              </span>
              <span className="text-[10px] text-muted">
                {entry.graveCount} RIP · {entry.trainerCount} trainer
                {entry.trainerCount === 1 ? "" : "s"}
              </span>
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
    <div className="space-y-3">
      <p className="text-xs text-muted">
        {missing.length} Modern Emerald species with zero pack appearances.{" "}
        <Link
          href={toolsHref(slug, "bounty")}
          className="font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
        >
          Hunt them in Bounty Hunter
        </Link>
      </p>
      <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {missing.map((entry) => (
          <li key={entry.pokedexId}>
            <Link
              href={toolsHref(slug, "pokedex", { id: entry.pokedexId })}
              title={entry.species}
              className="pressable flex flex-col items-center gap-0.5 rounded-md border border-frame/30 bg-surface/50 px-1 py-1.5 hover:border-interactive/40 hover:bg-interactive-soft/40"
            >
              <PokemonSpriteImage
                alt=""
                className="pixelated h-8 w-8 object-contain"
                height={32}
                pokedexId={entry.pokedexId}
                species={entry.species}
                width={32}
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
