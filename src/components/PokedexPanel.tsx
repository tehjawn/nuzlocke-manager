"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Frame } from "@/components/Frame";
import { StatGrid } from "@/components/StatGrid";
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
  recommendMoreSquadCounters,
  recommendSquadCounters,
  type SquadCounterSuggestion,
} from "@/lib/pokedex-squad-counter";
import type { PokemonType } from "@/lib/pokemon-types";
import { typesForPokedexId } from "@/lib/resolve-pokemon-types";
import {
  avatarImageClassName,
  avatarImageUrl,
  pokemonSpriteUrl,
} from "@/lib/sprites";
import { baseStatsForSpecies, STAT_KEYS } from "@/lib/stats";
import {
  defensiveMatchups,
  formatMatchupMult,
  type MatchupMult,
} from "@/lib/type-matchups";
import type { PokemonType as ChartType } from "@/lib/type-chart";
import { displayName, pokemonInSlot } from "@/lib/trainer-display";
import { toolsHref } from "@/lib/tools-routes";

/** Keep the first paint light; scroll loads more. */
const PAGE_SIZE = 32;

type PokedexPanelProps = {
  slug: string;
  trainers?: TrainerProfile[];
  /** Signed-in trainer on this season — Type Tips use their Main + Reserve. */
  myTrainerId?: string | null;
  initialId?: number | null;
};

export function PokedexPanel({
  slug,
  trainers = [],
  myTrainerId = null,
  initialId = null,
}: PokedexPanelProps) {
  const router = useRouter();
  const initial =
    initialId != null ? (findPokemonById(initialId) ?? null) : null;
  // Search is independent of selection — picking an entry must not rewrite the query.
  const [query, setQuery] = useState("");
  const [generation, setGeneration] = useState<number | null>(null);
  const [selected, setSelected] = useState<PokemonIndexEntry | null>(initial);
  const [tipExcludeEntryIds, setTipExcludeEntryIds] = useState<string[]>([]);
  const deferred = useDeferredValue(query);
  const searching = deferred.trim().length > 0;

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
  const stabMoves = useMemo(
    () => signatureMovesForTypes(types as ChartType[]),
    [types],
  );
  const bst = baseStats
    ? STAT_KEYS.reduce((sum, key) => sum + baseStats[key], 0)
    : null;

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

  function selectEntry(entry: PokemonIndexEntry) {
    setSelected(entry);
    setTipExcludeEntryIds([]);
    startTransition(() => {
      router.replace(
        toolsHref(slug, "pokedex", {
          id: entry.pokedexId,
        }),
        { scroll: false },
      );
    });
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
    if (!selected || types.length === 0 || tipSquad.length === 0) return;
    const shown = [
      ...tipExcludeEntryIds,
      ...typeTips.map((t) => t.entryId),
    ];
    const next = recommendMoreSquadCounters(types, tipSquad, shown, {
      excludePokedexId: selected.pokedexId,
      limit: 3,
    });
    if (next.length === 0) {
      setTipExcludeEntryIds([]);
      return;
    }
    setTipExcludeEntryIds(shown);
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
                          {/* Native img: lighter than next/image for dense lists. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pokemonSpriteUrl(mon.name, {
                              pokedexId: mon.pokedexId,
                            })}
                            alt=""
                            width={32}
                            height={32}
                            loading="lazy"
                            decoding="async"
                            className="pixelated h-8 w-8 shrink-0 object-contain"
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
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={pokemonSpriteUrl(mon.species, {
                                  pokedexId: mon.pokedexId,
                                  shiny: mon.isShiny,
                                })}
                                alt=""
                                width={32}
                                height={32}
                                loading="lazy"
                                decoding="async"
                                className="pixelated h-7 w-7 object-contain"
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
              entry={selected}
              types={types}
              abilities={abilities}
              baseStats={baseStats}
              bst={bst}
              matchups={matchups}
              stabMoves={stabMoves}
              typeTips={typeTips}
              tipsPending={tipsPending}
              tipTrainerLabel={tipTrainerLabel}
              tipSquadCount={tipSquad.length}
              canGoPrev={selectedIndex > 0}
              canGoNext={
                selectedIndex >= 0 && selectedIndex < results.length - 1
              }
              onPrev={() => step(-1)}
              onNext={() => step(1)}
              onMoreTips={showMoreTips}
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
  entry,
  types,
  abilities,
  baseStats,
  bst,
  matchups,
  stabMoves,
  typeTips,
  tipsPending,
  tipTrainerLabel,
  tipSquadCount,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onMoreTips,
}: {
  entry: PokemonIndexEntry;
  types: PokemonType[];
  abilities: string[];
  baseStats: ReturnType<typeof baseStatsForSpecies>;
  bst: number | null;
  matchups: ReturnType<typeof defensiveMatchups>;
  stabMoves: ReturnType<typeof signatureMovesForTypes>;
  typeTips: SquadCounterSuggestion[];
  tipsPending: boolean;
  tipTrainerLabel: string | null;
  tipSquadCount: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onMoreTips: () => void;
}) {
  const sprite = pokemonSpriteUrl(entry.name, { pokedexId: entry.pokedexId });

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
              <Image
                src={sprite}
                alt=""
                width={144}
                height={144}
                className="pixelated h-[85%] w-[85%] object-contain"
                unoptimized
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
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <p className="text-xs font-semibold tracking-tight text-muted">
                  Base stats
                </p>
                {bst != null ? (
                  <p className="text-[11px] font-semibold tabular-nums text-muted">
                    BST {bst}
                  </p>
                ) : null}
              </div>
              {baseStats ? (
                <StatGrid spread={baseStats} compact />
              ) : (
                <p className="text-sm text-muted">
                  Base stats aren’t catalogued for this forme yet — try the base
                  species.
                </p>
              )}
            </div>

            <MatchupSection
              title="Weak to"
              rows={[
                ...matchups.x4.map((type) => ({
                  type,
                  mult: 4 as MatchupMult,
                })),
                ...matchups.x2.map((type) => ({
                  type,
                  mult: 2 as MatchupMult,
                })),
              ]}
              empty="No super-effective weaknesses"
            />
            <MatchupSection
              title="Resists / immune"
              rows={[
                ...matchups.x0.map((type) => ({
                  type,
                  mult: 0 as MatchupMult,
                })),
                ...matchups.x025.map((type) => ({
                  type,
                  mult: 0.25 as MatchupMult,
                })),
                ...matchups.x05.map((type) => ({
                  type,
                  mult: 0.5 as MatchupMult,
                })),
              ]}
              empty="No resistances"
            />
          </div>
        </div>

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

        <div className="border-t border-frame/40 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold tracking-tight">Type tips</p>
              <p className="text-[11px] text-muted">
                {tipTrainerLabel
                  ? `From ${tipTrainerLabel}'s Main + Reserve movesets — not a damage calc.`
                  : "Sign in and join this season to see counters from your Main + Reserve."}
              </p>
            </div>
            {types.length > 0 && tipSquadCount > 0 ? (
              <button
                type="button"
                className="pressable rounded-lg border border-frame bg-surface px-3 py-2 text-xs font-semibold tracking-tight"
                onClick={onMoreTips}
              >
                More tips
              </button>
            ) : null}
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pokemonSpriteUrl(tip.pokemon.name, {
                        pokedexId: tip.pokemon.pokedexId,
                      })}
                      alt=""
                      width={48}
                      height={48}
                      loading="lazy"
                      decoding="async"
                      className="pixelated h-12 w-12 object-contain"
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
                  ? "Sign in to get tips from your board."
                  : tipSquadCount === 0
                    ? "Add Pokémon to your Main or Reserve to get tips."
                    : "None of your Main/Reserve moves look super-effective here."}
            </p>
          ) : null}
        </div>
      </div>
    </Frame>
  );
}

function MatchupSection({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ type: ChartType; mult: MatchupMult }>;
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
