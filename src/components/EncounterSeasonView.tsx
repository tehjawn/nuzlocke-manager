"use client";

import Link from "next/link";
import { useState } from "react";
import { EncounterLedger } from "@/components/EncounterLedger";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import type { EncounterRouteGroup } from "@/lib/encounter-ledger";
import type { EncounterSeasonHighlights } from "@/lib/encounter-stats";
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
  const hasCallouts = Boolean(
    highlights.mostLogged ||
      highlights.leastLogged ||
      highlights.hottestRoute,
  );

  return (
    <div className="space-y-5">
      <header className="space-y-1.5">
        <p className="text-xs font-semibold tracking-tight text-accent-deep">
          Season route claims
        </p>
        <h2 className="text-2xl font-bold tracking-tight">Encounter ledger</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Light route claims from catch routes on trainer boards — not a full
          encounter tracker. Stats reflect currently logged board state.
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
          {highlights.mostLogged ? (
            <SpeciesCallout
              label="Most logged"
              tied={highlights.mostLogged.tied}
              species={highlights.mostLogged.species}
              pokedexId={highlights.mostLogged.pokedexId}
              detail={`${highlights.mostLogged.count} on boards`}
            />
          ) : null}
          {highlights.leastLogged ? (
            <SpeciesCallout
              label="Rarest seen"
              tied={highlights.leastLogged.tied}
              species={highlights.leastLogged.species}
              pokedexId={highlights.leastLogged.pokedexId}
              detail={`${highlights.leastLogged.count} on boards`}
            />
          ) : null}
          {highlights.hottestRoute ? (
            <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                Hottest route
                {highlights.hottestRoute.tied ? " · tied" : ""}
              </p>
              <p className="mt-1 font-display text-sm font-bold leading-tight">
                {highlights.hottestRoute.route}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">
                {highlights.hottestRoute.claimCount} claim
                {highlights.hottestRoute.claimCount === 1 ? "" : "s"} ·{" "}
                {highlights.hottestRoute.trainerCount} trainer
                {highlights.hottestRoute.trainerCount === 1 ? "" : "s"}
              </p>
            </div>
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

function SpeciesCallout({
  label,
  tied,
  species,
  pokedexId,
  detail,
}: {
  label: string;
  tied: boolean;
  species: string;
  pokedexId: number | null;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
      <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
        {label}
        {tied ? " · tied" : ""}
      </p>
      <p className="mt-1 flex items-center gap-2.5 font-display text-sm font-bold leading-tight">
        <span className="relative inline-block h-10 w-10 shrink-0">
          <PokemonSpriteImage
            alt=""
            className="pixelated h-full w-full object-contain"
            height={40}
            pokedexId={pokedexId}
            species={species}
            width={40}
          />
        </span>
        <span className="min-w-0">
          {species}
          <span className="mt-0.5 block font-sans text-[11px] font-normal text-muted">
            {detail}
          </span>
        </span>
      </p>
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
