"use client";

import { useEffect, useMemo, useState } from "react";
import { listSurvivalMarketsAction } from "@/app/actions/survival";
import { ModeTabs } from "@/components/ModeTabs";
import { PokemonDetailsModal } from "@/components/PokemonDetailsModal";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { StatBlock } from "@/components/SeasonStatCards";
import {
  SurvivalSentimentIcon,
  survivalSentimentFromPoll,
} from "@/components/SurvivalPollChip";
import { SurvivalPollSection } from "@/components/SurvivalPollSection";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import type { SurvivalMarketListItem } from "@/lib/survival-market-types";
import {
  buildMarketsBoard,
  buildQuietRows,
  computeMarketsPulse,
  isContested,
  isLongshot,
  isOpenMarket,
  isResolvedMarket,
  isUpset,
  monLabel,
  sortsForMode,
  viewerCalledIt,
  type MarketsBoardFilters,
  type MarketsBoardRow,
  type QuietMarketRow,
} from "@/lib/survival-market-board";
import {
  parseMarketsMode,
  parseMarketsSort,
  type MarketsMode,
  type MarketsSort,
} from "@/lib/tools-routes";

type SurvivalMarketsPanelProps = {
  slug: string;
  trainers: TrainerProfile[];
  enabled: boolean;
  viewerUserId?: string | null;
  initialMode?: MarketsMode | null;
  initialSort?: MarketsSort | null;
};

const MODE_TABS: ReadonlyArray<{ id: MarketsMode; label: string }> = [
  { id: "floor", label: "Floor" },
  { id: "settled", label: "Settled" },
  { id: "book", label: "My book" },
];

function writeMarketsUrl(mode: MarketsMode, sort: MarketsSort) {
  const url = new URL(window.location.href);
  url.searchParams.set("tool", "markets");
  url.searchParams.set("mode", mode);
  url.searchParams.set("sort", sort);
  window.history.replaceState(window.history.state, "", url.href);
}

function OddsBar({
  survivePct,
  total,
  status,
}: {
  survivePct: number;
  total: number;
  status: SurvivalMarketListItem["status"];
}) {
  if (total <= 0 && isOpenMarket(status)) {
    return (
      <div className="h-2.5 w-full overflow-hidden rounded-sm border border-dashed border-frame/50 bg-surface-2/60" />
    );
  }
  const diePct = Math.max(0, 100 - survivePct);
  const surviveWin = status === "RESOLVED_SURVIVE";
  const dieWin = status === "RESOLVED_DIE";
  return (
    <div
      className="flex h-2.5 w-full overflow-hidden rounded-sm border border-frame/45 bg-surface-2"
      title={`${survivePct}% Survive · ${diePct}% Die`}
      role="img"
      aria-label={`${survivePct}% Survive, ${diePct}% Die`}
    >
      <span
        className={`h-full ${
          dieWin
            ? "bg-accent/35"
            : surviveWin
              ? "bg-accent"
              : "bg-accent/80"
        }`}
        style={{ width: `${survivePct}%` }}
      />
      <span
        className={`h-full ${
          surviveWin
            ? "bg-danger/35"
            : dieWin
              ? "bg-danger"
              : "bg-danger/75"
        }`}
        style={{ width: `${diePct}%` }}
      />
    </div>
  );
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

function pulseLabel(species: string, nickname: string | null): string {
  const label = monLabel(species, nickname);
  return label.length > 14 ? `${label.slice(0, 13)}…` : label;
}

function emptyCopy(mode: MarketsMode, sort: MarketsSort): string {
  if (mode === "settled") {
    return "No resolved polls yet — they land here when a mon dies or clears the run.";
  }
  if (mode === "book") {
    return "Nothing in your book yet — cast a Survive/Die take on the Floor.";
  }
  if (sort === "fresh") {
    return "Every living Main and Reserve already has votes — check Hottest.";
  }
  if (sort === "contested") {
    return "No coin-flip races with enough votes yet.";
  }
  if (sort === "longshots") {
    return "No crowded locks yet — the Pack hasn’t piled onto one side.";
  }
  return "No open races with votes yet — try Fresh to place the first take.";
}

export function SurvivalMarketsPanel({
  slug,
  trainers,
  enabled,
  viewerUserId = null,
  initialMode = null,
  initialSort = null,
}: SurvivalMarketsPanelProps) {
  const [mode, setMode] = useState<MarketsMode>(() =>
    parseMarketsMode(initialMode),
  );
  const [sort, setSort] = useState<MarketsSort>(() =>
    parseMarketsSort(initialSort, parseMarketsMode(initialMode)),
  );
  const [markets, setMarkets] = useState<SurvivalMarketListItem[] | null>(
    null,
  );
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [detailsPokemon, setDetailsPokemon] = useState<PokemonEntry | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [needsMyVote, setNeedsMyVote] = useState(false);
  const [contestedOnly, setContestedOnly] = useState(false);
  const [minVotes, setMinVotes] = useState<0 | 1 | 3 | 5>(0);
  const [slot, setSlot] = useState<MarketsBoardFilters["slot"]>("all");

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

  const quiet = useMemo(
    () =>
      enabled ? buildQuietRows(trainers, marketByPokemonId) : ([] as QuietMarketRow[]),
    [enabled, marketByPokemonId, trainers],
  );

  const filters = useMemo(
    (): MarketsBoardFilters => ({
      query,
      trainerId,
      needsMyVote,
      contestedOnly,
      minVotes,
      slot,
    }),
    [contestedOnly, minVotes, needsMyVote, query, slot, trainerId],
  );

  const rows = useMemo((): MarketsBoardRow[] => {
    if (!markets) return [];
    return buildMarketsBoard({
      mode,
      sort,
      markets,
      quiet,
      pokemonById,
      filters,
      viewerUserId,
    });
  }, [filters, markets, mode, pokemonById, quiet, sort, viewerUserId]);

  const pulse = useMemo(
    () => (markets ? computeMarketsPulse(markets, viewerUserId) : null),
    [markets, viewerUserId],
  );

  const selectMode = (next: MarketsMode) => {
    const nextSort = parseMarketsSort(sort, next);
    setMode(next);
    setSort(nextSort);
    setExpandedKey(null);
    writeMarketsUrl(next, nextSort);
  };

  const selectSort = (next: MarketsSort) => {
    setSort(next);
    setExpandedKey(null);
    writeMarketsUrl(mode, next);
  };

  if (!enabled) {
    return (
      <p className="rounded-xl border border-frame/40 bg-surface-2/50 px-4 py-5 text-sm text-muted">
        Survive / Die polls are turned off for this season. A Game Master can
        re-enable them in the GM console.
      </p>
    );
  }

  if (markets === null) {
    return <p className="text-sm text-muted">Loading survival polls…</p>;
  }

  const recordPct =
    pulse?.record && pulse.record.scored > 0
      ? Math.round((pulse.record.correct / pulse.record.scored) * 100)
      : null;

  return (
    <div className="space-y-4">
      {pulse ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatBlock
            icon={<span aria-hidden>◎</span>}
            value={String(pulse.openRaces)}
            label="Open races"
            hint="Open polls with at least one vote"
          />
          <button
            type="button"
            disabled={!pulse.closest}
            onClick={() => {
              if (!pulse.closest) return;
              setMode("floor");
              setSort("contested");
              setExpandedKey(null);
              setQuery(
                pulse.closest.nickname?.trim() || pulse.closest.species,
              );
              writeMarketsUrl("floor", "contested");
            }}
            className="text-left disabled:cursor-default"
          >
            <StatBlock
              icon={<span aria-hidden>~</span>}
              value={
                pulse.closest
                  ? pulseLabel(pulse.closest.species, pulse.closest.nickname)
                  : "—"
              }
              label="Closest race"
              hint={
                pulse.closest
                  ? `${pulse.closest.survivePct}% Survive · tap to focus`
                  : "Needs 3+ votes near 50/50"
              }
            />
          </button>
          <button
            type="button"
            disabled={!pulse.hottest}
            onClick={() => {
              if (!pulse.hottest) return;
              setMode("floor");
              setSort("hottest");
              setExpandedKey(null);
              setQuery(
                pulse.hottest.nickname?.trim() || pulse.hottest.species,
              );
              writeMarketsUrl("floor", "hottest");
            }}
            className="text-left disabled:cursor-default"
          >
            <StatBlock
              icon={<span aria-hidden>▲</span>}
              value={
                pulse.hottest
                  ? pulseLabel(pulse.hottest.species, pulse.hottest.nickname)
                  : "—"
              }
              label="Hottest"
              hint={
                pulse.hottest
                  ? `${pulse.hottest.total} votes · tap to focus`
                  : "No volume yet"
              }
            />
          </button>
          <StatBlock
            icon={<span aria-hidden>✓</span>}
            value={
              pulse.record
                ? `${pulse.record.correct}/${pulse.record.scored}`
                : viewerUserId
                  ? "—"
                  : "—"
            }
            label="Your record"
            hint={
              pulse.record && recordPct != null
                ? `${recordPct}% called · My book`
                : viewerUserId
                  ? "No settled takes yet"
                  : "Sign in to keep a book"
            }
          />
        </div>
      ) : null}

      <ModeTabs
        aria-label="Survive / Die lenses"
        idPrefix="markets"
        value={mode}
        tabs={MODE_TABS}
        onValueChange={selectMode}
        size="sm"
        panelClassName="space-y-4"
      >
        <p className="text-xs text-muted">
          Crowd Survive / Die takes — no stakes, just volume, contested races,
          and who called it when they fall or clear.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[12rem] flex-1 space-y-1 text-xs font-semibold text-muted">
            Search
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Species, nickname, trainer…"
              className="w-full rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink"
            />
          </label>
          <label className="min-w-[10rem] space-y-1 text-xs font-semibold text-muted">
            Trainer
            <select
              value={trainerId}
              onChange={(event) => setTrainerId(event.target.value)}
              className="w-full rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink"
            >
              <option value="">All trainers</option>
              {trainers.map((trainer) => (
                <option key={trainer.id} value={trainer.id}>
                  {trainer.handle}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[9rem] space-y-1 text-xs font-semibold text-muted">
            Sort
            <select
              value={sort}
              onChange={(event) =>
                selectSort(event.target.value as MarketsSort)
              }
              className="w-full rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink"
            >
              {sortsForMode(mode).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[7rem] space-y-1 text-xs font-semibold text-muted">
            Slot
            <select
              value={slot}
              onChange={(event) =>
                setSlot(event.target.value as MarketsBoardFilters["slot"])
              }
              className="w-full rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink"
            >
              <option value="all">Main + Reserve</option>
              <option value="MAIN">Main only</option>
              <option value="RESERVE">Reserve only</option>
            </select>
          </label>
          <label className="min-w-[6.5rem] space-y-1 text-xs font-semibold text-muted">
            Min votes
            <select
              value={minVotes}
              onChange={(event) =>
                setMinVotes(Number(event.target.value) as 0 | 1 | 3 | 5)
              }
              className="w-full rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink"
            >
              <option value={0}>Any</option>
              <option value={1}>1+</option>
              <option value={3}>3+</option>
              <option value={5}>5+</option>
            </select>
          </label>
        </div>

        <div
          role="group"
          aria-label="Quick filters"
          className="flex flex-wrap gap-1.5"
        >
          <button
            type="button"
            aria-pressed={needsMyVote}
            disabled={!viewerUserId}
            onClick={() => setNeedsMyVote((v) => !v)}
            className={`pressable rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              needsMyVote
                ? "border-interactive/50 bg-interactive-soft/50 text-interactive"
                : "border-frame/50 bg-surface text-muted hover:bg-surface/80"
            }`}
          >
            Needs my vote
          </button>
          <button
            type="button"
            aria-pressed={contestedOnly}
            onClick={() => setContestedOnly((v) => !v)}
            className={`pressable rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              contestedOnly
                ? "border-warn/50 bg-warn/15 text-warn"
                : "border-frame/50 bg-surface text-muted hover:bg-surface/80"
            }`}
          >
            Contested only
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-frame/40 bg-surface/60 px-4 py-5 text-sm text-muted">
            {emptyCopy(mode, sort)}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => {
              const expandId =
                row.kind === "quiet"
                  ? row.pokemon.id
                  : (row.market.pokemonId ?? row.key);
              const expanded = expandedKey === expandId;
              if (row.kind === "quiet") {
                return (
                  <li key={row.key} className="min-w-0">
                    <QuietMarketTile
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
                <li key={row.key} className="min-w-0">
                  <MarketTile
                    market={row.market}
                    pokemon={row.pokemon}
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

function MarketTile({
  market,
  pokemon,
  expanded,
  onToggle,
  onOpenDetails,
  onVoted,
  viewerUserId,
}: {
  market: SurvivalMarketListItem;
  pokemon: PokemonEntry | null;
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
  const called = viewerCalledIt(market);
  const contested = isOpenMarket(market.status) && isContested(market);
  const longshot = isOpenMarket(market.status) && isLongshot(market);
  const upset = isUpset(market);
  const slotLabel =
    pokemon?.slot === "MAIN"
      ? "Main"
      : pokemon?.slot === "RESERVE"
        ? "Reserve"
        : null;

  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-xl border bg-surface ${
        isResolvedMarket(market.status)
          ? market.status === "RESOLVED_DIE"
            ? "border-danger/35"
            : "border-accent/35"
          : "border-frame/45"
      }`}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          onClick={canExpand ? onToggle : undefined}
          disabled={!canExpand}
          className="pressable flex min-w-0 flex-1 flex-col gap-2 px-3 py-2.5 text-left disabled:cursor-default"
          aria-expanded={canExpand ? expanded : undefined}
        >
          <span className="flex items-start gap-2.5">
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
                    poll={pollTally}
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
                    You:{" "}
                    {market.myPrediction === "SURVIVE" ? "Survive" : "Die"}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                {showSpecies ? <span>{market.species}</span> : null}
                <span>{market.trainer.handle}</span>
                {slotLabel ? <span>{slotLabel}</span> : null}
              </span>
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
          </span>

          <OddsBar
            survivePct={market.survivePct}
            total={market.total}
            status={market.status}
          />

          <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            <span className="font-semibold text-ink/80">
              {statusLine(market)}
            </span>
            {contested ? (
              <span className="rounded border border-warn/40 bg-warn/12 px-1 py-0.5 text-[10px] font-bold text-warn">
                Contested
              </span>
            ) : null}
            {longshot ? (
              <span className="rounded border border-frame/50 bg-surface-2 px-1 py-0.5 text-[10px] font-bold text-muted">
                Lock lean
              </span>
            ) : null}
            {upset ? (
              <span className="rounded border border-danger/35 bg-danger/10 px-1 py-0.5 text-[10px] font-bold text-danger">
                Upset
              </span>
            ) : null}
            {called === true ? (
              <span className="rounded border border-accent/40 bg-accent/12 px-1 py-0.5 text-[10px] font-bold text-accent-deep">
                Called it
              </span>
            ) : null}
            {called === false ? (
              <span className="rounded border border-frame/50 bg-surface-2 px-1 py-0.5 text-[10px] font-bold text-muted">
                Missed
              </span>
            ) : null}
          </span>

          {market.lastComment ? (
            <span className="line-clamp-2 text-[11px] leading-snug text-ink/70">
              “{market.lastComment}”
            </span>
          ) : null}
        </button>

        {onOpenDetails ? (
          <div className="border-t border-frame/35 px-3 py-1.5">
            <button
              type="button"
              onClick={onOpenDetails}
              className="text-[11px] font-semibold text-interactive hover:underline"
            >
              Details
            </button>
          </div>
        ) : null}
      </div>

      {expanded && market.pokemonId ? (
        <div className="border-t border-frame/35 px-3 py-2.5">
          {called !== null ? (
            <p
              className={`mb-2 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
                called
                  ? "border-accent/40 bg-accent/12 text-accent-deep"
                  : "border-danger/35 bg-danger/10 text-danger"
              }`}
            >
              {called
                ? "You called it."
                : "You missed this one."}
            </p>
          ) : isResolvedMarket(market.status) ? (
            <p className="mb-2 rounded-lg border border-frame/40 bg-surface-2/50 px-2.5 py-1.5 text-xs font-semibold text-muted">
              {market.status === "RESOLVED_DIE"
                ? "Cooked — see who called Die."
                : "Locked — see who called Survive."}
            </p>
          ) : null}
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

function QuietMarketTile({
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
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-dashed border-frame/50 bg-surface/80">
      <button
        type="button"
        onClick={onToggle}
        className="pressable flex min-w-0 flex-1 flex-col gap-2 px-3 py-2.5 text-left"
        aria-expanded={expanded}
      >
        <span className="flex items-start gap-2.5">
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
        </span>
        <OddsBar survivePct={50} total={0} status="OPEN" />
        <span className="text-[11px] font-semibold text-muted">
          Place the first take
        </span>
      </button>
      <div className="border-t border-frame/35 px-3 py-1.5">
        <button
          type="button"
          onClick={onOpenDetails}
          className="text-[11px] font-semibold text-interactive hover:underline"
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
