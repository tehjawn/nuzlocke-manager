"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Frame } from "@/components/Frame";
import { EvolutionPath } from "@/components/EvolutionPath";
import { PlaystyleChips } from "@/components/PlaystyleChips";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { PokedexTierList, CompetitiveTierBrief } from "@/components/PokedexTierList";
import { StatGrid, type StatRankChip } from "@/components/StatGrid";
import { TypeBadge } from "@/components/TypeBadge";
import { abilitiesForSpecies } from "@/data/pokemon-lookups";
import {
  findPokemonById,
  findPokemonByName,
  POKEMON_GENERATIONS,
  searchPokemonIndex,
  type PokemonIndexEntry,
} from "@/data/pokemon-index";
import { signatureMovesForTypes } from "@/data/type-signature-moves";
import type {
  PokemonEntry,
  TrainerProfile,
} from "@/lib/challenge-types";
import {
  formatHolderHandles,
  personalSpeciesStatus,
  speciesOwnershipFor,
  type SpeciesOwnershipLookup,
  type SpeciesOwnershipStatus,
} from "@/lib/encounter-stats";
import { recommendPlaystyle, type PlaystyleHint } from "@/lib/playstyle";
import {
  getSquadCounterReroll,
  recommendSquadCounters,
  type SquadCounterSuggestion,
} from "@/lib/pokedex-squad-counter";
import type { PokemonType } from "@/lib/pokemon-types";
import { typesForPokedexId } from "@/lib/resolve-pokemon-types";
import {
  baseStatRanksFor,
  statRankHint,
  statRankToneClass,
  type SpeciesStatRanks,
} from "@/lib/species-ranks";
import {
  avatarImageClassName,
  avatarImageUrl,
} from "@/lib/sprites";
import { baseStatsForSpecies, bstOf, STAT_KEYS, STAT_LABELS } from "@/lib/stats";
import {
  defensiveMatchups,
  formatMatchupMult,
  stabOffense,
  type MatchupMult,
  type StabOffense,
} from "@/lib/type-matchups";
import type { PokemonType as ChartType } from "@/lib/type-chart";
import { displayName, pokemonInSlot } from "@/lib/trainer-display";
import {
  parsePokedexMode,
  toolsHref,
  type PokedexMode,
} from "@/lib/tools-routes";

/** Keep the first paint light; scroll loads more. */
const PAGE_SIZE = 32;

const POKEDEX_MODES: ReadonlyArray<{ id: PokedexMode; label: string }> = [
  { id: "briefing", label: "Directory" },
  { id: "tiers", label: "BST Tier List" },
  { id: "competitive", label: "Competitive Tier List" },
];

type PokedexPanelProps = {
  slug: string;
  trainers?: TrainerProfile[];
  /** Signed-in trainer on this season — Type Tips use their Main + Reserve. */
  myTrainerId?: string | null;
  signedIn?: boolean;
  initialId?: number | null;
  initialMode?: PokedexMode | null;
};

export function PokedexPanel({
  slug,
  trainers = [],
  myTrainerId = null,
  signedIn = false,
  initialId = null,
  initialMode = null,
}: PokedexPanelProps) {
  const initial =
    initialId != null ? (findPokemonById(initialId) ?? null) : null;
  // Search is independent of selection — picking an entry must not rewrite the query.
  const [query, setQuery] = useState("");
  const [generation, setGeneration] = useState<number | null>(null);
  const [selected, setSelected] = useState<PokemonIndexEntry | null>(initial);
  const [tipExcludeEntryIds, setTipExcludeEntryIds] = useState<string[]>([]);
  const [mode, setMode] = useState<PokedexMode>(
    parsePokedexMode(initialMode),
  );
  const deferred = useDeferredValue(query);
  const searching = deferred.trim().length > 0;

  // Mode / species URL updates use history.pushState (not the Next router) so
  // the tools page doesn't RSC-refetch. Sync React state when the user hits
  // back/forward through those entries.
  useEffect(() => {
    function onPopState() {
      const url = new URL(window.location.href);
      if (url.searchParams.get("tool") !== "pokedex") return;
      const nextMode = parsePokedexMode(url.searchParams.get("mode"));
      const idRaw = url.searchParams.get("id");
      const idNum = idRaw != null ? Number(idRaw) : NaN;
      setMode(nextMode);
      setTipExcludeEntryIds([]);
      if (Number.isFinite(idNum) && idNum > 0) {
        const entry = findPokemonById(idNum);
        if (entry) setSelected(entry);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const myTrainer = useMemo(
    () =>
      myTrainerId
        ? (trainers.find((t) => t.id === myTrainerId) ?? null)
        : null,
    [myTrainerId, trainers],
  );
  const tipSquad = useMemo(() => {
    if (!myTrainer) return [];
    return [
      ...pokemonInSlot(myTrainer, "MAIN"),
      ...pokemonInSlot(myTrainer, "RESERVE"),
    ];
  }, [myTrainer]);
  const tipTrainerLabel = myTrainer ? displayName(myTrainer) : null;
  const tipSquadHasMoves = useMemo(
    () => tipSquad.some((mon) => mon.moves.some((m) => m.trim().length > 0)),
    [tipSquad],
  );

  const results = useMemo(() => {
    const hits = searchPokemonIndex(deferred, {
      generation,
      // Browse like a National Dex: base species in order. Search can surface formes.
      formesOnly: searching ? null : false,
    });
    // Browse path is already National-Dex ordered; only search needs a sort.
    if (!searching) return hits;
    return [...hits].sort((a, b) => a.pokedexId - b.pokedexId);
  }, [deferred, generation, searching]);

  const resetKey = `${deferred}|${generation ?? "all"}`;
  const { visible, total, hasMore, scrollRef, sentinelRef, loadMore } =
    useDexListReveal(results, resetKey);

  const selectedIndex = useMemo(
    () =>
      selected
        ? results.findIndex((m) => m.pokedexId === selected.pokedexId)
        : -1,
    [results, selected],
  );

  const types = useMemo(
    () => (selected ? typesForPokedexId(selected.pokedexId) : []),
    [selected],
  );
  const baseStats = selected
    ? baseStatsForSpecies(selected.pokedexId)
    : null;
  const abilities = selected ? abilitiesForSpecies(selected.pokedexId) : [];
  const matchups = useMemo(() => defensiveMatchups(types), [types]);
  const offense = useMemo(() => stabOffense(types), [types]);
  const stabMoves = useMemo(
    () => signatureMovesForTypes(types as ChartType[]),
    [types],
  );
  const bst = baseStats ? bstOf(baseStats) : null;

  // Species-only playstyle: no nature / ability / IVs, so the tip stays true
  // of every copy of this species rather than describing someone's specimen.
  const playstyle = useMemo(
    () =>
      selected ? recommendPlaystyle({ pokedexId: selected.pokedexId }) : null,
    [selected],
  );
  const ranks = useMemo(
    () => (selected ? baseStatRanksFor(selected.pokedexId) : null),
    [selected],
  );
  const statRankChips = useMemo(() => {
    if (!ranks) return null;
    const chips: Partial<Record<(typeof STAT_KEYS)[number], StatRankChip>> = {};
    for (const key of STAT_KEYS) {
      const result = ranks.perStat[key];
      chips[key] = {
        letter: result.rank,
        toneClass: statRankToneClass(result.rank),
        hint: statRankHint(STAT_LABELS[key], result, ranks.peerCount),
      };
    }
    return chips;
  }, [ranks]);
  const ownership = useMemo(
    () =>
      selected ? speciesOwnershipFor(trainers, selected.pokedexId) : null,
    [selected, trainers],
  );
  // Gate on the resolved profile, not the raw id — "signed in but not on this
  // season" has an id upstream and still deserves no personal chip.
  const myOwnershipStatus = useMemo(
    () =>
      ownership && myTrainer
        ? personalSpeciesStatus(ownership, myTrainer.id)
        : null,
    [ownership, myTrainer],
  );

  // Defer tip ranking so species selection paints first.
  const deferredSelected = useDeferredValue(selected);
  const deferredTipExcludeEntryIds = useDeferredValue(tipExcludeEntryIds);
  const deferredTipSquad = useDeferredValue(tipSquad);
  const typeTips = useMemo(() => {
    if (!deferredSelected || deferredTipSquad.length === 0) return [];
    const tipTypes = typesForPokedexId(deferredSelected.pokedexId);
    if (tipTypes.length === 0) return [];
    return recommendSquadCounters(tipTypes, deferredTipSquad, {
      excludePokedexId: deferredSelected.pokedexId,
      excludeEntryIds: deferredTipExcludeEntryIds,
      limit: 3,
    });
  }, [deferredSelected, deferredTipExcludeEntryIds, deferredTipSquad]);
  const tipsPending =
    deferredSelected?.pokedexId !== selected?.pokedexId ||
    deferredTipExcludeEntryIds !== tipExcludeEntryIds ||
    deferredTipSquad !== tipSquad;
  const tipReroll = useMemo(() => {
    if (!deferredSelected) return null;
    const tipTypes = typesForPokedexId(deferredSelected.pokedexId);
    return getSquadCounterReroll(
      tipTypes,
      deferredTipSquad,
      typeTips,
      deferredTipExcludeEntryIds,
      {
        excludePokedexId: deferredSelected.pokedexId,
        limit: 3,
      },
    );
  }, [
    deferredSelected,
    deferredTipExcludeEntryIds,
    deferredTipSquad,
    typeTips,
  ]);

  function writePokedexUrl(
    nextMode: PokedexMode,
    nextId: number | null,
  ) {
    // Keep the shareable ?mode= / ?id= URL without a tools-route RSC refetch.
    // pushState (not replace) so BST/Competitive → briefing is undoable.
    const url = new URL(window.location.href);
    url.searchParams.set("tool", "pokedex");
    if (nextMode === "tiers" || nextMode === "competitive") {
      url.searchParams.set("mode", nextMode);
      url.searchParams.delete("id");
    } else {
      url.searchParams.delete("mode");
      if (nextId != null) url.searchParams.set("id", String(nextId));
      else url.searchParams.delete("id");
    }
    if (url.href === window.location.href) return;
    window.history.pushState(window.history.state, "", url.href);
  }

  function selectEntry(entry: PokemonIndexEntry) {
    setSelected(entry);
    setTipExcludeEntryIds([]);
    setMode("briefing");
    writePokedexUrl("briefing", entry.pokedexId);
  }

  function selectMode(next: PokedexMode) {
    if (next === mode) return;
    setMode(next);
    writePokedexUrl(
      next,
      next === "briefing" ? (selected?.pokedexId ?? null) : null,
    );
  }

  function selectFromRun(mon: PokemonEntry) {
    const entry =
      (mon.pokedexId != null && mon.pokedexId > 0
        ? findPokemonById(mon.pokedexId)
        : undefined) ?? findPokemonByName(mon.species);
    if (entry) selectEntry(entry);
  }

  function step(delta: -1 | 1) {
    if (selectedIndex < 0) return;
    const next = results[selectedIndex + delta];
    if (next) selectEntry(next);
  }

  function showMoreTips() {
    if (tipReroll) setTipExcludeEntryIds(tipReroll.excludeEntryIds);
  }

  const scoutTrainers = useMemo(
    () =>
      [...trainers]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((trainer) => ({
          trainer,
          main: pokemonInSlot(trainer, "MAIN"),
        }))
        .filter((row) => row.main.length > 0),
    [trainers],
  );

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Pokédex mode"
        className="flex flex-wrap gap-1.5"
      >
        {POKEDEX_MODES.map((entry) => {
          const active = mode === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`pressable inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold tracking-tight ${
                active
                  ? "bg-accent text-[var(--on-accent)]"
                  : "border border-frame bg-surface"
              }`}
              onClick={() => selectMode(entry.id)}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      {mode === "tiers" || mode === "competitive" ? (
        <PokedexTierList
          ladder={mode === "competitive" ? "competitive" : "bst"}
          trainers={trainers}
          myTrainerId={myTrainerId}
          onSelectSpecies={(pokedexId) => {
            const entry = findPokemonById(pokedexId);
            if (entry) selectEntry(entry);
          }}
        />
      ) : (
        <>
      <div className="space-y-1.5">
        <p className="text-sm font-bold text-muted">Search</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="min-w-0 w-full flex-1 rounded-lg border border-frame bg-surface px-3 py-2 text-sm"
            placeholder="Name or National Dex #…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            aria-label="Search Pokédex"
          />
          <div
            role="group"
            aria-label="Generation"
            className="flex flex-wrap items-center gap-1.5 sm:shrink-0"
          >
            <GenChip
              active={generation == null}
              onClick={() => setGeneration(null)}
            >
              All
            </GenChip>
            {POKEMON_GENERATIONS.map((g) => (
              <GenChip
                key={g}
                active={generation === g}
                onClick={() => setGeneration(g)}
              >
                {g}
              </GenChip>
            ))}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4 self-start">
          <Frame
            title="Pokédex"
            dense
            className="min-w-0"
            actions={
              <span className="text-[11px] font-semibold tabular-nums text-[var(--on-chrome)]/80">
                {total}
              </span>
            }
          >
            {total === 0 ? (
              <p className="px-1 py-2 text-sm text-muted">No matches.</p>
            ) : (
              <div
                ref={scrollRef}
                className="max-h-[min(22rem,42vh)] overflow-y-auto overscroll-contain lg:max-h-[min(28rem,48vh)]"
              >
                <ul role="listbox" aria-label="Pokédex list">
                  {visible.map((mon) => {
                    const active = selected?.pokedexId === mon.pokedexId;
                    return (
                      <li key={mon.pokedexId}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={`pressable flex w-full items-center gap-2 border-b border-frame/25 px-1.5 py-1 text-left last:border-b-0 ${
                            active
                              ? "bg-interactive-soft"
                              : "hover:bg-surface-2/80"
                          }`}
                          onClick={() => selectEntry(mon)}
                        >
                          <span className="w-9 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums text-muted">
                            {formatDexNo(mon.pokedexId)}
                          </span>
                          <PokemonSpriteImage
                            alt=""
                            className="pixelated h-8 w-8 shrink-0 object-contain"
                            height={32}
                            loading="lazy"
                            pokedexId={mon.pokedexId}
                            species={mon.name}
                            width={32}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight">
                            {mon.name}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {hasMore ? (
                  <div
                    ref={sentinelRef}
                    className="flex flex-col items-center gap-1.5 py-2"
                  >
                    <span className="text-[10px] text-muted">
                      {total - visible.length} more…
                    </span>
                    <button
                      type="button"
                      className="pressable rounded-lg border border-frame bg-surface px-2.5 py-1 text-[11px] font-semibold"
                      onClick={loadMore}
                    >
                      Load more
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </Frame>

          <Frame title="Scouter" dense className="min-w-0">
            {scoutTrainers.length === 0 ? (
              <p className="px-1 py-2 text-sm text-muted">
                No main squads to scout yet.
              </p>
            ) : (
              <ul className="max-h-[min(20rem,38vh)] space-y-3 overflow-y-auto overscroll-contain">
                {scoutTrainers.map(({ trainer, main }) => (
                  <li key={trainer.id}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <Image
                        src={avatarImageUrl(trainer.avatarSpriteKey)}
                        alt=""
                        width={24}
                        height={24}
                        className={avatarImageClassName(
                          trainer.avatarSpriteKey,
                          "h-6 w-6",
                        )}
                        unoptimized
                      />
                      <p className="min-w-0 truncate text-xs font-bold tracking-tight">
                        {trainer.handle}
                      </p>
                    </div>
                    <ul className="flex flex-wrap gap-1">
                      {main.map((mon) => {
                        const active =
                          selected != null &&
                          ((mon.pokedexId != null &&
                            mon.pokedexId === selected.pokedexId) ||
                            mon.species.toLowerCase() ===
                              selected.name.toLowerCase());
                        const label =
                          mon.nickname?.trim() || mon.species;
                        return (
                          <li key={mon.id}>
                            <button
                              type="button"
                              title={`${label}${mon.nickname ? ` (${mon.species})` : ""}`}
                              aria-label={`Look up ${mon.species}`}
                              aria-pressed={active}
                              className={`pressable flex h-9 w-9 items-center justify-center rounded-md border ${
                                active
                                  ? "border-interactive/50 bg-interactive-soft"
                                  : "border-frame/40 bg-surface-2 hover:border-frame"
                              }`}
                              onClick={() => selectFromRun(mon)}
                            >
                              <PokemonSpriteImage
                                alt=""
                                className="pixelated h-7 w-7 object-contain"
                                height={32}
                                loading="lazy"
                                pokedexId={mon.pokedexId}
                                shiny={mon.isShiny}
                                species={mon.species}
                                width={32}
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Frame>
        </div>

        {selected ? (
          <div className="min-w-0 self-start lg:sticky lg:top-4">
            <PokedexEntry
              slug={slug}
              entry={selected}
              types={types}
              abilities={abilities}
              baseStats={baseStats}
              bst={bst}
              playstyle={playstyle}
              ranks={ranks}
              statRankChips={statRankChips}
              matchups={matchups}
              offense={offense}
              ownership={ownership}
              myOwnershipStatus={myOwnershipStatus}
              packTrainerCount={trainers.length}
              stabMoves={stabMoves}
              typeTips={typeTips}
              tipRerollAction={tipReroll?.action ?? null}
              tipsPending={tipsPending}
              tipTrainerLabel={tipTrainerLabel}
              tipSquadCount={tipSquad.length}
              tipSquadHasMoves={tipSquadHasMoves}
              signedIn={signedIn}
              canGoPrev={selectedIndex > 0}
              canGoNext={
                selectedIndex >= 0 && selectedIndex < results.length - 1
              }
              onPrev={() => step(-1)}
              onNext={() => step(1)}
              onMoreTips={showMoreTips}
              onSelectSpecies={(pokedexId) => {
                const next = findPokemonById(pokedexId);
                if (next) selectEntry(next);
              }}
            />
          </div>
        ) : (
          <Frame title="Data" className="self-start">
            <p className="text-sm text-muted">
              Pick a species from the Pokédex or tap a sprite under Scouter —
              details fill in here.
            </p>
          </Frame>
        )}
      </div>
        </>
      )}
    </div>
  );
}

function formatDexNo(id: number): string {
  if (id >= 10000) return String(id);
  return String(id).padStart(3, "0");
}

function GenChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`pressable inline-flex h-[2.375rem] items-center rounded-lg px-2.5 text-sm font-semibold tracking-tight ${
        active
          ? "bg-accent text-[var(--on-accent)]"
          : "border border-frame bg-surface"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PokedexEntry({
  slug,
  entry,
  types,
  abilities,
  baseStats,
  bst,
  playstyle,
  ranks,
  statRankChips,
  matchups,
  offense,
  ownership,
  myOwnershipStatus,
  packTrainerCount,
  stabMoves,
  typeTips,
  tipRerollAction,
  tipsPending,
  tipTrainerLabel,
  tipSquadCount,
  tipSquadHasMoves,
  signedIn,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onMoreTips,
  onSelectSpecies,
}: {
  slug: string;
  entry: PokemonIndexEntry;
  types: PokemonType[];
  abilities: string[];
  baseStats: ReturnType<typeof baseStatsForSpecies>;
  bst: number | null;
  playstyle: PlaystyleHint | null;
  ranks: SpeciesStatRanks | null;
  statRankChips: Partial<Record<(typeof STAT_KEYS)[number], StatRankChip>> | null;
  matchups: ReturnType<typeof defensiveMatchups>;
  offense: StabOffense;
  ownership: SpeciesOwnershipLookup | null;
  myOwnershipStatus: SpeciesOwnershipStatus | null;
  packTrainerCount: number;
  stabMoves: ReturnType<typeof signatureMovesForTypes>;
  typeTips: SquadCounterSuggestion[];
  tipRerollAction: "more" | "restart" | null;
  tipsPending: boolean;
  tipTrainerLabel: string | null;
  tipSquadCount: number;
  tipSquadHasMoves: boolean;
  signedIn: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onMoreTips: () => void;
  onSelectSpecies: (pokedexId: number) => void;
}) {
  return (
    <Frame
      title={`${formatDexNo(entry.pokedexId)}  ${entry.name}`}
      actions={
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="pressable rounded-md border border-[var(--on-chrome)]/25 bg-[var(--on-chrome)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--on-chrome)] disabled:opacity-40"
            disabled={!canGoPrev}
            aria-label="Previous Pokémon"
            onClick={onPrev}
          >
            ◀
          </button>
          <button
            type="button"
            className="pressable rounded-md border border-[var(--on-chrome)]/25 bg-[var(--on-chrome)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--on-chrome)] disabled:opacity-40"
            disabled={!canGoNext}
            aria-label="Next Pokémon"
            onClick={onNext}
          >
            ▶
          </button>
        </div>
      }
      className="min-w-0"
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-start">
          <div className="flex flex-col items-center gap-2 sm:items-stretch">
            <div className="mx-auto flex aspect-square w-36 items-center justify-center rounded-lg border border-frame bg-surface-2 sm:mx-0 sm:w-full">
              <PokemonSpriteImage
                alt=""
                className="pixelated h-[85%] w-[85%] object-contain"
                height={144}
                pokedexId={entry.pokedexId}
                species={entry.name}
                width={144}
              />
            </div>
            {types.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-1 sm:justify-start">
                {types.map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </div>
            ) : null}
            <dl className="w-full space-y-1 text-center sm:text-left">
              <div>
                <dt className="text-[10px] font-semibold tracking-tight text-muted">
                  Gen
                </dt>
                <dd className="text-sm font-semibold">
                  {entry.generation}
                  {entry.isForme ? " · forme" : ""}
                </dd>
              </div>
              {abilities.length > 0 ? (
                <div>
                  <dt className="text-[10px] font-semibold tracking-tight text-muted">
                    Ability
                  </dt>
                  <dd className="text-sm font-semibold leading-snug">
                    {abilities.join(" / ")}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="min-w-0 space-y-4">
            {playstyle ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold tracking-tight text-muted">
                  Role
                </p>
                <PlaystyleChips
                  primary={playstyle.primary}
                  secondary={playstyle.secondary}
                />
                <p className="mt-1.5 text-[11px] leading-snug text-muted">
                  {playstyle.tip}
                </p>
                {ranks ? (
                  <p className="mt-1 text-[11px] leading-snug text-muted">
                    {ranks.headline}
                  </p>
                ) : null}
              </div>
            ) : null}

            <CompetitiveTierBrief pokedexId={entry.pokedexId} />

            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <p className="text-xs font-semibold tracking-tight text-muted">
                  Base stats
                </p>
                {bst != null ? (
                  <p className="flex items-baseline gap-1.5 text-[11px] font-semibold tabular-nums text-muted">
                    BST {bst}
                    {ranks ? (
                      <span
                        className={`inline-flex items-center rounded border px-1 text-[10px] font-bold leading-tight ${statRankToneClass(ranks.bst.rank)}`}
                        title={statRankHint("BST", ranks.bst, ranks.peerCount)}
                      >
                        {ranks.bst.rank}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              {baseStats ? (
                <>
                  <StatGrid compact ranks={statRankChips} spread={baseStats} />
                  {ranks ? (
                    <p className="mt-1.5 text-[11px] leading-snug text-muted">
                      Letters rank each stat F→S against the {ranks.peerCount}{" "}
                      Modern Emerald species with catalogued stats.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted">
                  Base stats aren’t catalogued for this forme yet — try the base
                  species.
                </p>
              )}
            </div>
          </div>
        </div>

        <PackStatusStrip
          myStatus={myOwnershipStatus}
          ownership={ownership}
          packTrainerCount={packTrainerCount}
          slug={slug}
        />

        <TypeStory matchups={matchups} offense={offense} types={types} />

        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-tight text-muted">
            STAB toolkit
          </p>
          <p className="mb-2 text-[11px] text-muted">
            Example moves of this typing — not a full learnset.
          </p>
          {stabMoves.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {stabMoves.map((move) => (
                <li
                  key={`${move.type}-${move.name}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-frame/50 bg-surface-2 px-2 py-1 text-[11px] font-semibold"
                >
                  <TypeBadge type={move.type as PokemonType} />
                  <span>{move.name}</span>
                  <span className="text-muted">{move.category}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No typing on file for moves.</p>
          )}
        </div>

        <EvolutionPath
          pokedexId={entry.pokedexId}
          species={entry.name}
          currentLabel="Current"
          onSelectSpecies={onSelectSpecies}
        />

        <div className="border-t border-frame/40 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold tracking-tight">Type tips</p>
              <p className="text-[11px] text-muted">
                {tipTrainerLabel
                  ? `From ${tipTrainerLabel}'s Main + Reserve movesets — not a damage calc.`
                  : signedIn
                    ? "Join this season to see counters from your Main + Reserve."
                    : "Sign in and join this season to see counters from your Main + Reserve."}
              </p>
            </div>
            {tipRerollAction && (
              <button
                className="pressable rounded-lg border border-frame bg-surface px-3 py-2 text-xs font-semibold tracking-tight"
                data-testid="type-tips-more"
                disabled={tipsPending}
                onClick={onMoreTips}
                type="button"
              >
                {tipRerollAction === "restart" ? "Start over" : "More tips"}
              </button>
            )}
          </div>

          {typeTips.length > 0 ? (
            <ol
              className={`mt-3 space-y-2 transition-opacity ${
                tipsPending ? "opacity-50" : ""
              }`}
            >
              {typeTips.map((tip, i) => (
                <li
                  key={tip.entryId}
                  className="flex flex-col gap-2.5 rounded-lg border border-frame/50 bg-surface-2/80 p-2.5 sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface text-[11px] font-bold tabular-nums text-muted">
                      {i + 1}
                    </span>
                    <PokemonSpriteImage
                      alt=""
                      className="pixelated h-12 w-12 object-contain"
                      height={48}
                      loading="lazy"
                      pokedexId={tip.pokemon.pokedexId}
                      species={tip.pokemon.name}
                      width={48}
                    />
                    <div className="min-w-0">
                      <p className="font-bold leading-tight">
                        {tip.displayName}
                      </p>
                      {tip.displayName !== tip.pokemon.name ? (
                        <p className="text-[11px] text-muted">
                          {tip.pokemon.name}
                          {tip.slot === "RESERVE" ? " · Reserve" : ""}
                        </p>
                      ) : tip.slot === "RESERVE" ? (
                        <p className="text-[11px] text-muted">Reserve</p>
                      ) : null}
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {tip.types.map((t) => (
                          <TypeBadge key={t} type={t} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 sm:border-l sm:border-frame/40 sm:pl-3">
                    <p className="text-sm leading-snug">
                      Move:{" "}
                      <span className="font-semibold">{tip.moveName}</span>
                      <span className="text-muted">
                        {" "}
                        ({tip.moveCategory} · {tip.attackType} ·{" "}
                        {tip.offenseMult}×)
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">{tip.reason}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : types.length > 0 ? (
            <p className="mt-3 text-sm text-muted">
              {tipsPending
                ? "Ranking type tips…"
                : !tipTrainerLabel
                  ? signedIn
                    ? "Join this season to get tips from your board."
                    : "Sign in to get tips from your board."
                  : tipSquadCount === 0
                    ? "Add Pokémon to your Main or Reserve to get tips."
                    : !tipSquadHasMoves
                      ? "Import a save (or add moves) on your board to get tips."
                      : "None of your Main/Reserve moves look super-effective here."}
            </p>
          ) : null}
        </div>
      </div>
    </Frame>
  );
}

type MatchupRow = { type: ChartType; mult: MatchupMult };

/** Pair a bucket of defending types with the multiplier they all share. */
function matchupRows(
  types: readonly ChartType[],
  mult: MatchupMult,
): MatchupRow[] {
  return types.map((type) => ({ type, mult }));
}

function MatchupSection({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: MatchupRow[];
  empty: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold tracking-tight text-muted">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-[11px] text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {rows.map((row) => (
            <li
              key={`${title}-${row.type}`}
              className="inline-flex items-center gap-1 rounded-lg border border-frame/40 bg-surface-2 px-1.5 py-1"
            >
              <TypeBadge type={row.type as PokemonType} />
              <span className="text-[10px] font-bold tabular-nums text-muted">
                {formatMatchupMult(row.mult)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Species-centric type briefing: what hurts it (full typing) and what it
 * threatens (STAB only). Separate from Type tips, which answers the different
 * question of what the viewer's own board can do about it.
 */
function TypeStory({
  types,
  matchups,
  offense,
}: {
  types: PokemonType[];
  matchups: ReturnType<typeof defensiveMatchups>;
  offense: StabOffense;
}) {
  return (
    <div className="border-t border-frame/40 pt-4">
      <p className="text-sm font-bold tracking-tight">Type story</p>
      <p className="text-[11px] text-muted">
        Defense reads its full typing; offense is STAB only — coverage moves
        change it.
      </p>
      {types.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Typing isn’t on file for this forme — matchups unavailable.
        </p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <MatchupSection
            empty="No super-effective weaknesses"
            rows={[
              ...matchupRows(matchups.x4, 4),
              ...matchupRows(matchups.x2, 2),
            ]}
            title="Weak to"
          />
          <MatchupSection
            empty="No resistances"
            rows={[
              ...matchupRows(matchups.x0, 0),
              ...matchupRows(matchups.x025, 0.25),
              ...matchupRows(matchups.x05, 0.5),
            ]}
            title="Resists / immune"
          />
          <MatchupSection
            empty="Its own typing hits nothing for extra damage"
            rows={matchupRows(offense.strongVs, 2)}
            title="Its STAB threatens"
          />
          <MatchupSection
            empty="Nothing resists its STAB"
            rows={[
              ...matchupRows(offense.immuneTo, 0),
              ...matchupRows(offense.resistedBy, 0.5),
            ]}
            title="Walled by"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Theme tokens only — no Tailwind `dark:` variants. Those compile to
 * `prefers-color-scheme`, which this app's `[data-theme]` toggle doesn't set,
 * so an OS-light / app-dark viewer would get unreadable text.
 */
function packStatusChipClass(status: SpeciesOwnershipStatus): string {
  if (status === "owned") {
    return "border-accent/35 bg-accent/10 text-accent-deep";
  }
  if (status === "encountered") {
    return "border-accent-2/45 bg-accent-2/15 text-ink";
  }
  return "border-frame/40 bg-surface/60 text-muted";
}

function packStatusLabel(status: SpeciesOwnershipStatus): string {
  if (status === "owned") return "Owned";
  if (status === "encountered") return "Encountered";
  return "Untouched";
}

function personalStatusLabel(status: SpeciesOwnershipStatus): string {
  if (status === "owned") return "You own this";
  if (status === "encountered") return "You’ve seen this";
  return "Not on your board";
}

/**
 * Where this species stands across the season. Deep-links to Pokémon Ownership
 * rather than rebuilding its tracker — this is the one-species answer.
 */
function PackStatusStrip({
  slug,
  ownership,
  myStatus,
  packTrainerCount,
}: {
  slug: string;
  ownership: SpeciesOwnershipLookup | null;
  myStatus: SpeciesOwnershipStatus | null;
  packTrainerCount: number;
}) {
  if (!ownership) return null;

  const owners = formatHolderHandles(ownership.owners, 3);
  const seenBy = formatHolderHandles(ownership.encounteredBy, 3);
  // A species the ROM doesn't ship isn't merely unowned — never let it
  // borrow the "Untouched" tier and read as catchable.
  const offRom = !ownership.inModernEmerald;

  return (
    <div className="border-t border-frame/40 pt-4">
      <p className="text-sm font-bold tracking-tight">In this pack</p>
      <p className="text-[11px] text-muted">
        Who’s holding it, who’s only seen it — across every board this season.
      </p>

      {packTrainerCount === 0 ? (
        <p className="mt-3 text-sm text-muted">No boards to compare yet.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <span
            className={`inline-flex items-center gap-1.5 self-start rounded-md border px-2 py-1 text-xs font-semibold ${
              offRom
                ? "border-frame/40 bg-surface/60 text-muted"
                : packStatusChipClass(ownership.status)
            }`}
          >
            {offRom ? "Not in Modern Emerald" : packStatusLabel(ownership.status)}
          </span>

          {myStatus ? (
            <span className="inline-flex items-center self-start rounded-md border border-frame/50 bg-surface px-2 py-1 text-xs font-semibold text-muted">
              {personalStatusLabel(myStatus)}
            </span>
          ) : null}

          {owners ? (
            <p className="text-xs text-muted">
              Held by <span className="font-semibold text-ink">{owners}</span>
            </p>
          ) : null}
          {seenBy ? (
            <p className="text-xs text-muted">
              Seen by <span className="font-semibold text-ink">{seenBy}</span>
            </p>
          ) : null}

          {offRom ? (
            <p className="text-xs text-muted">Not catchable this season.</p>
          ) : ownership.status === "untouched" ? (
            <Link
              className="pressable self-start rounded-lg border border-frame bg-surface px-3 py-2 text-xs font-semibold tracking-tight"
              data-testid="pack-status-bounty-link"
              href={toolsHref(slug, "bounty", { mode: "tracker" })}
            >
              Not owned yet — see all
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

function useDexListReveal<T>(items: T[], resetKey: string) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [prevKey, setPrevKey] = useState(resetKey);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  if (prevKey !== resetKey) {
    setPrevKey(resetKey);
    setVisibleCount(PAGE_SIZE);
  }

  const total = items.length;
  const visible = items.slice(0, visibleCount);
  const hasMore = visibleCount < total;

  const loadMore = () => {
    setVisibleCount((count) => Math.min(count + PAGE_SIZE, total));
  };

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => Math.min(count + PAGE_SIZE, total));
        }
      },
      { root, rootMargin: "120px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, total, visibleCount, resetKey]);

  return {
    visible,
    total,
    hasMore,
    scrollRef: scrollRef as RefObject<HTMLDivElement>,
    sentinelRef: sentinelRef as RefObject<HTMLDivElement>,
    loadMore,
  };
}
