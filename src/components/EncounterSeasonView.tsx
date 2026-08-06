"use client";

import Link from "next/link";
import { useState } from "react";
import { EncounterLedger } from "@/components/EncounterLedger";
import { EncounterRouteMap } from "@/components/EncounterRouteMap";
import { ModeTabs } from "@/components/ModeTabs";
import { PersonalRoutesView } from "@/components/PersonalRoutesView";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import {
  DexStatIcon,
  PokeballStatIcon,
  RouteStatIcon,
  RouteTopCallout,
  SpeciesStatIcon,
  SpeciesTopCallout,
  StatBlock,
} from "@/components/SeasonStatCards";
import type { EncounterRouteGroup } from "@/lib/encounter-ledger";
import type { EncounterSeasonHighlights } from "@/lib/encounter-stats";
import type { ModernEmeraldSpeciesRef } from "@/lib/modern-emerald-dex";
import type { PersonalRouteStatus } from "@/lib/personal-routes";
import { toolsHref } from "@/lib/tools-routes";

type EncounterSeasonViewProps = {
  groups: EncounterRouteGroup[];
  highlights: EncounterSeasonHighlights;
  missing: ModernEmeraldSpeciesRef[];
  myTrainerId?: string | null;
  routeStatuses: PersonalRouteStatus[];
  slug: string;
};

type EncounterView = "claims" | "map" | "missing" | "routes";

export function EncounterSeasonView({
  groups,
  highlights,
  missing,
  myTrainerId = null,
  routeStatuses,
  slug,
}: EncounterSeasonViewProps) {
  const [view, setView] = useState<EncounterView>(() =>
    myTrainerId ? "routes" : "claims",
  );
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
              href={toolsHref(slug, "stats", { section: "species" })}
              hrefLabel="Season stats →"
              showCount
            />
          ) : null}
          {highlights.rarestSeen.length > 0 ? (
            <SpeciesTopCallout
              entries={highlights.rarestSeen}
              href={`/challenges/${slug}/encounters/rarest`}
              label="Rarest seen"
            />
          ) : null}
          {highlights.deadliestRoutes.length > 0 ? (
            <RouteTopCallout
              label="Deadliest routes"
              entries={highlights.deadliestRoutes}
              href={toolsHref(slug, "stats", { section: "memorial" })}
              hrefLabel="Season stats →"
            />
          ) : null}
        </div>
      ) : null}

      <ModeTabs
        aria-label="Encounter views"
        idPrefix="encounters"
        size="sm"
        value={view}
        tabs={[
          { id: "claims", label: "Route claims", "data-testid": "encounter-view-claims" },
          {
            id: "routes",
            label: myTrainerId ? "My routes" : "Open routes",
            "data-testid": "encounter-view-routes",
          },
          { id: "map", label: "Map", "data-testid": "encounter-view-map" },
          { id: "missing", label: "Missing dex", "data-testid": "encounter-view-missing" },
        ] satisfies ReadonlyArray<{
          id: EncounterView;
          label: string;
          "data-testid": string;
        }>}
        onValueChange={setView}
        trailing={
          <Link
            href={toolsHref(slug, "bounty")}
            className="text-xs font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
          >
            Open Pokémon Ownership
          </Link>
        }
      >
        {view === "missing" ? (
          <MissingModernEmeraldGrid missing={missing} slug={slug} />
        ) : null}
        {view === "claims" ? (
          <EncounterLedger groups={groups} slug={slug} />
        ) : null}
        {view === "map" ? (
          <EncounterRouteMap
            groups={groups}
            myTrainerId={myTrainerId}
            onJumpToClaims={() => setView("claims")}
            routeStatuses={routeStatuses}
            slug={slug}
          />
        ) : null}
        {view === "routes" ? (
          <PersonalRoutesView
            myTrainerId={myTrainerId}
            routeStatuses={routeStatuses}
            slug={slug}
          />
        ) : null}
      </ModeTabs>
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
          See who owns them
        </Link>
      </p>
      <ul className="grid grid-cols-5 gap-1.5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-12">
        {missing.map((entry) => (
          <li key={entry.pokedexId}>
            <Link
              href={toolsHref(slug, "pokedex", { id: entry.pokedexId })}
              title={entry.species}
              aria-label={`${entry.species} (#${String(entry.pokedexId).padStart(3, "0")})`}
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
