"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
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
            icon={<PokeballStatIcon />}
            value={String(highlights.totalLogged)}
            label="Pokémon on boards"
            hint="Party, box, graves & seen"
          />
          <StatBlock
            icon={<SpeciesStatIcon />}
            value={String(highlights.uniqueSpecies)}
            label="Species seen"
            hint="Distinct across the pack"
          />
          <StatBlock
            icon={<DexStatIcon />}
            value={`${mePct}%`}
            label="Modern Emerald dex"
            hint={`${highlights.meDexLogged} of ${highlights.meDexTotal} logged`}
          />
          <StatBlock
            icon={<RouteStatIcon />}
            value={String(highlights.routesClaimed)}
            label="Routes claimed"
            hint="At least one catch logged"
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
  icon,
  value,
  label,
  hint,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  hint: string;
}) {
  return (
    <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[11px] font-bold leading-snug text-muted">
          {label}
        </p>
        <span className="shrink-0 text-accent-deep/80" aria-hidden>
          {icon}
        </span>
      </div>
      <p className="mt-1.5 font-display text-2xl font-bold tabular-nums leading-none tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-[10px] leading-snug text-muted/80">{hint}</p>
    </div>
  );
}

function PokeballStatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.25" />
    </svg>
  );
}

function SpeciesStatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="8" cy="9" r="2.5" />
      <circle cx="16" cy="9" r="2.5" />
      <circle cx="12" cy="15.5" r="2.5" />
    </svg>
  );
}

function DexStatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <circle cx="12" cy="11" r="3" />
      <path d="M9.5 17h5" strokeLinecap="round" />
    </svg>
  );
}

function RouteStatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M6 18c2-4 3-6 3-9a3 3 0 016 0c0 3 1 5 3 9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9" r="1.25" fill="currentColor" stroke="none" />
    </svg>
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
        {entries.map((entry, index) => (
          <li
            key={`${entry.species}-${entry.pokedexId ?? "x"}`}
            className="flex items-center gap-2"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface/80 text-sm font-bold tabular-nums text-muted">
              {index + 1}
            </span>
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
              {entry.species}
              {showCount ? (
                <span className="font-sans font-normal text-muted">
                  {" · x"}
                  {entry.count}
                </span>
              ) : null}
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
      <ol className="mt-2 space-y-1">
        {entries.map((entry, index) => (
          <li
            key={entry.route}
            className="flex items-center gap-2"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface/80 text-sm font-bold tabular-nums text-muted">
              {index + 1}
            </span>
            <span className="min-w-0 truncate font-display text-sm font-bold leading-none">
              {entry.route}
              <span className="font-sans font-normal text-muted">
                {" · "}
                {entry.graveCount} fallen
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
