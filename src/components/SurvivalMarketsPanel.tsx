"use client";

import { useEffect, useMemo, useState } from "react";
import { listSurvivalMarketsAction } from "@/app/actions/survival";
import { ModeTabs } from "@/components/ModeTabs";
import { PokemonDetailsModal } from "@/components/PokemonDetailsModal";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import {
  SurvivalPollChip,
  SurvivalSentimentIcon,
  survivalSentimentFromPoll,
} from "@/components/SurvivalPollChip";
import { SurvivalPollSection } from "@/components/SurvivalPollSection";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import type { SurvivalMarketListItem } from "@/lib/survival-market-types";

type MarketsFilter = "open" | "resolved" | "all";

type SurvivalMarketsPanelProps = {
  slug: string;
  trainers: TrainerProfile[];
  enabled: boolean;
  viewerUserId?: string | null;
};

type BoardRow =
  | {
      kind: "market";
      key: string;
      market: SurvivalMarketListItem;
      pokemon: PokemonEntry | null;
    }
  | {
      kind: "quiet";
      key: string;
      pokemon: PokemonEntry;
      trainer: { id: string; handle: string };
    };

const FILTER_TABS: ReadonlyArray<{ id: MarketsFilter; label: string }> = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
];

function monLabel(species: string, nickname: string | null): string {
  const nick = nickname?.trim();
  return nick || species;
}

function statusLine(market: SurvivalMarketListItem): string {
  if (market.status === "RESOLVED_DIE") {
    return `Cooked · ${market.die}/${market.total} called Die`;
  }
  if (market.status === "RESOLVED_SURVIVE") {
    return `Locked · ${market.survive}/${market.total} called Survive`;
  }
  if (market.total === 0) return "No votes yet";
  return `${market.survivePct}% Survive · ${market.total} vote${market.total === 1 ? "" : "s"}`;
}

function isOpenStatus(status: SurvivalMarketListItem["status"]): boolean {
  return status === "OPEN";
}

function isResolvedStatus(status: SurvivalMarketListItem["status"]): boolean {
  return status === "RESOLVED_SURVIVE" || status === "RESOLVED_DIE";
}

export function SurvivalMarketsPanel({
  slug,
  trainers,
  enabled,
  viewerUserId = null,
}: SurvivalMarketsPanelProps) {
  const [filter, setFilter] = useState<MarketsFilter>("open");
  const [markets, setMarkets] = useState<SurvivalMarketListItem[] | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [detailsPokemon, setDetailsPokemon] = useState<PokemonEntry | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void listSurvivalMarketsAction({ slug }).then((rows) => {
      if (cancelled) return;
      setMarkets(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const refreshMarkets = () => {
    void listSurvivalMarketsAction({ slug }).then(setMarkets);
  };

  const pokemonById = useMemo(() => {
    const map = new Map<string, PokemonEntry>();
    for (const trainer of trainers) {
      for (const mon of trainer.pokemon) {
        map.set(mon.id, mon);
      }
    }
    return map;
  }, [trainers]);

  const marketByPokemonId = useMemo(() => {
    const map = new Map<string, SurvivalMarketListItem>();
    for (const market of markets ?? []) {
      if (market.pokemonId) map.set(market.pokemonId, market);
    }
    return map;
  }, [markets]);

  const rows = useMemo((): BoardRow[] => {
    const marketRows: BoardRow[] = (markets ?? []).map((market) => ({
      kind: "market",
      key: `market-${market.id}`,
      market,
      pokemon: market.pokemonId
        ? (pokemonById.get(market.pokemonId) ?? null)
        : null,
    }));

    // Living MAIN/RESERVE with no market yet — first-vote targets on Open/All.
    const quietRows: BoardRow[] = [];
    if (enabled && (filter === "open" || filter === "all")) {
      for (const trainer of trainers) {
        for (const mon of trainer.pokemon) {
          if (mon.slot !== "MAIN" && mon.slot !== "RESERVE") continue;
          if (marketByPokemonId.has(mon.id)) continue;
          quietRows.push({
            kind: "quiet",
            key: `quiet-${mon.id}`,
            pokemon: mon,
            trainer: { id: trainer.id, handle: trainer.handle },
          });
        }
      }
    }

    const filteredMarkets = marketRows.filter((row) => {
      if (row.kind !== "market") return false;
      if (filter === "open") return isOpenStatus(row.market.status);
      if (filter === "resolved") return isResolvedStatus(row.market.status);
      return true;
    });

    const openMarkets = filteredMarkets
      .filter(
        (row) => row.kind === "market" && isOpenStatus(row.market.status),
      )
      .sort((a, b) => {
        if (a.kind !== "market" || b.kind !== "market") return 0;
        return b.market.total - a.market.total;
      });
    const resolvedMarkets = filteredMarkets
      .filter(
        (row) => row.kind === "market" && isResolvedStatus(row.market.status),
      )
      .sort((a, b) => {
        if (a.kind !== "market" || b.kind !== "market") return 0;
        const aAt = a.market.resolvedAt ?? "";
        const bAt = b.market.resolvedAt ?? "";
        return bAt.localeCompare(aAt);
      });

    if (filter === "resolved") return resolvedMarkets;
    if (filter === "open") {
      return [...openMarkets, ...quietRows];
    }
    return [...openMarkets, ...quietRows, ...resolvedMarkets];
  }, [enabled, filter, marketByPokemonId, markets, pokemonById, trainers]);

  if (!enabled) {
    return (
      <p className="rounded-xl border border-frame/40 bg-surface-2/50 px-4 py-5 text-sm text-muted">
        Survive / Die polls are turned off for this season. A Game Master can
        re-enable them in the GM console.
      </p>
    );
  }

  if (markets === null) {
    return (
      <p className="text-sm text-muted">Loading survival polls…</p>
    );
  }

  return (
    <div className="space-y-4">
      <ModeTabs
        aria-label="Survive / Die filters"
        value={filter}
        tabs={FILTER_TABS}
        onValueChange={setFilter}
        size="sm"
      >
        <p className="mb-3 text-xs text-muted">
          Open polls on living Main and Reserve — cast a take here or from a
          Pokémon&apos;s details. Resolved polls keep who called it.
        </p>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-frame/40 bg-surface/60 px-4 py-5 text-sm text-muted">
            {filter === "resolved"
              ? "No resolved polls yet — they land here when a mon dies or clears the run."
              : filter === "open"
                ? "No living party or box Pokémon to poll right now."
                : "No survival polls in this season yet."}
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const expandId =
                row.kind === "quiet"
                  ? row.pokemon.id
                  : (row.market.pokemonId ?? row.key);
              const expanded = expandedKey === expandId;
              if (row.kind === "quiet") {
                return (
                  <li key={row.key}>
                    <QuietMarketCard
                      pokemon={row.pokemon}
                      trainerHandle={row.trainer.handle}
                      expanded={expanded}
                      onToggle={() =>
                        setExpandedKey(expanded ? null : expandId)
                      }
                      onOpenDetails={() => setDetailsPokemon(row.pokemon)}
                      onVoted={refreshMarkets}
                      viewerUserId={viewerUserId}
                    />
                  </li>
                );
              }
              return (
                <li key={row.key}>
                  <MarketCard
                    market={row.market}
                    expanded={expanded}
                    onToggle={() =>
                      setExpandedKey(expanded ? null : expandId)
                    }
                    onOpenDetails={
                      row.pokemon
                        ? () => setDetailsPokemon(row.pokemon)
                        : undefined
                    }
                    onVoted={refreshMarkets}
                    viewerUserId={viewerUserId}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </ModeTabs>

      <PokemonDetailsModal
        open={detailsPokemon !== null}
        pokemon={detailsPokemon}
        onClose={() => setDetailsPokemon(null)}
        slug={slug}
        showCompetitiveDetails={false}
        survivalMarketsEnabled={enabled}
        viewerUserId={viewerUserId}
      />
    </div>
  );
}

function MarketCard({
  market,
  expanded,
  onToggle,
  onOpenDetails,
  onVoted,
  viewerUserId,
}: {
  market: SurvivalMarketListItem;
  expanded: boolean;
  onToggle: () => void;
  onOpenDetails?: () => void;
  onVoted?: () => void;
  viewerUserId: string | null;
}) {
  const label = monLabel(market.species, market.nickname);
  const showSpecies = Boolean(market.nickname?.trim());
  const pollTally = {
    marketId: market.id,
    status: market.status,
    survive: market.survive,
    die: market.die,
    total: market.total,
    myPrediction: market.myPrediction,
  };
  const sentiment = survivalSentimentFromPoll(pollTally);
  const canExpand = Boolean(market.pokemonId);

  return (
    <div className="overflow-hidden rounded-xl border border-frame/45 bg-surface">
      <div className="flex items-stretch gap-0">
        <button
          type="button"
          onClick={canExpand ? onToggle : undefined}
          disabled={!canExpand}
          className="pressable flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default"
          aria-expanded={canExpand ? expanded : undefined}
        >
          <PokemonSpriteImage
            species={market.species}
            pokedexId={market.pokedexId}
            shiny={market.isShiny}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 shrink-0"
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-bold leading-tight">
                {label}
              </span>
              {sentiment ? (
                <SurvivalSentimentIcon
                  poll={{
                    marketId: market.id,
                    status: market.status,
                    survive: market.survive,
                    die: market.die,
                    total: market.total,
                    myPrediction: market.myPrediction,
                  }}
                  className="h-3.5 w-3.5"
                />
              ) : null}
              {market.myPrediction ? (
                <span
                  className={`rounded border px-1 py-0.5 text-[10px] font-bold ${
                    market.myPrediction === "SURVIVE"
                      ? "border-accent/40 bg-accent/12 text-accent-deep"
                      : "border-danger/40 bg-danger/10 text-danger"
                  }`}
                >
                  You: {market.myPrediction === "SURVIVE" ? "Survive" : "Die"}
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
              {showSpecies ? <span>{market.species}</span> : null}
              <span>{market.trainer.handle}</span>
              <span>{statusLine(market)}</span>
            </span>
            {market.total > 0 && isOpenStatus(market.status) ? (
              <span className="mt-1.5 block max-w-xs">
                <SurvivalPollChip poll={pollTally} />
              </span>
            ) : null}
          </span>
          {canExpand ? (
            <span
              aria-hidden
              className="shrink-0 text-sm text-muted transition-transform"
              style={{
                transform: expanded ? "rotate(90deg)" : undefined,
              }}
            >
              ›
            </span>
          ) : null}
        </button>
        {onOpenDetails ? (
          <button
            type="button"
            onClick={onOpenDetails}
            className="pressable shrink-0 border-l border-frame/40 px-3 text-[11px] font-semibold text-interactive hover:bg-interactive-soft/40"
          >
            Details
          </button>
        ) : null}
      </div>
      {expanded && market.pokemonId ? (
        <div className="border-t border-frame/35 px-3 py-2.5">
          <SurvivalPollSection
            pokemonId={market.pokemonId}
            enabled
            viewerUserId={viewerUserId}
            onVoted={onVoted}
          />
        </div>
      ) : null}
    </div>
  );
}

function QuietMarketCard({
  pokemon,
  trainerHandle,
  expanded,
  onToggle,
  onOpenDetails,
  onVoted,
  viewerUserId,
}: {
  pokemon: PokemonEntry;
  trainerHandle: string;
  expanded: boolean;
  onToggle: () => void;
  onOpenDetails: () => void;
  onVoted?: () => void;
  viewerUserId: string | null;
}) {
  const label = monLabel(pokemon.species, pokemon.nickname);
  const showSpecies = Boolean(pokemon.nickname?.trim());

  return (
    <div className="overflow-hidden rounded-xl border border-dashed border-frame/50 bg-surface/80">
      <div className="flex items-stretch gap-0">
        <button
          type="button"
          onClick={onToggle}
          className="pressable flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
          aria-expanded={expanded}
        >
          <PokemonSpriteImage
            species={pokemon.species}
            pokedexId={pokemon.pokedexId}
            shiny={pokemon.isShiny}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 opacity-90"
          />
          <span className="min-w-0 flex-1">
            <span className="truncate text-sm font-bold leading-tight">
              {label}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
              {showSpecies ? <span>{pokemon.species}</span> : null}
              <span>{trainerHandle}</span>
              <span>
                {pokemon.slot === "MAIN" ? "Main" : "Reserve"} · no votes yet
              </span>
            </span>
          </span>
          <span
            aria-hidden
            className="shrink-0 text-sm text-muted"
            style={{ transform: expanded ? "rotate(90deg)" : undefined }}
          >
            ›
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenDetails}
          className="pressable shrink-0 border-l border-frame/40 px-3 text-[11px] font-semibold text-interactive hover:bg-interactive-soft/40"
        >
          Details
        </button>
      </div>
      {expanded ? (
        <div className="border-t border-frame/35 px-3 py-2.5">
          <SurvivalPollSection
            pokemonId={pokemon.id}
            enabled
            viewerUserId={viewerUserId}
            onVoted={onVoted}
          />
        </div>
      ) : null}
    </div>
  );
}
