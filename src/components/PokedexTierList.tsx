"use client";

import { useMemo, useState, type ReactNode } from "react";
import { findPokemonById, POKEMON_GENERATIONS } from "@/data/pokemon-index";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import type { TrainerProfile } from "@/lib/challenge-types";
import {
  speciesOwnershipBoard,
  type SpeciesOwnershipStatus,
} from "@/lib/encounter-stats";
import { POKEMON_TYPES, type PokemonType } from "@/lib/pokemon-types";
import { typesForPokedexId } from "@/lib/resolve-pokemon-types";
import { evolutionsFrom } from "@/lib/species-evolutions";
import {
  rankBandLabel,
  speciesTierList,
  statRankToneClass,
  type SpeciesTierEntry,
} from "@/lib/species-ranks";

type PokedexTierListProps = {
  trainers: TrainerProfile[];
  myTrainerId?: string | null;
  onSelectSpecies: (pokedexId: number) => void;
};

type OwnershipFilter = "all" | "owned" | "mine" | "untouched";

const FILTER_SELECT_CLASS =
  "rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink";

/**
 * BST ladder over the Modern Emerald roster — inverse of the per-species
 * briefing ranks. Letters and tones come from the same `speciesTierList` /
 * `statRankToneClass` path so an S here never disagrees with the briefing.
 */
export function PokedexTierList({
  trainers,
  myTrainerId = null,
  onSelectSpecies,
}: PokedexTierListProps) {
  const [type, setType] = useState<PokemonType | null>(null);
  const [generation, setGeneration] = useState<number | null>(null);
  const [finalOnly, setFinalOnly] = useState(false);
  const [ownership, setOwnership] = useState<OwnershipFilter>("all");

  const tiers = useMemo(() => speciesTierList(), []);
  const boardById = useMemo(() => {
    const map = new Map<
      number,
      { status: SpeciesOwnershipStatus; ownedByMe: boolean }
    >();
    for (const entry of speciesOwnershipBoard(trainers)) {
      map.set(entry.pokedexId, {
        status: entry.status,
        ownedByMe: entry.owners.some((o) => o.trainerId === myTrainerId),
      });
    }
    return map;
  }, [trainers, myTrainerId]);

  const filteredBuckets = useMemo(() => {
    return tiers
      .map((bucket) => ({
        ...bucket,
        entries: bucket.entries.filter((entry) =>
          matchesFilters(entry, {
            type,
            generation,
            finalOnly,
            ownership,
            boardById,
            myTrainerId,
          }),
        ),
      }))
      .filter((bucket) => bucket.entries.length > 0);
  }, [tiers, type, generation, finalOnly, ownership, boardById, myTrainerId]);

  const visibleCount = filteredBuckets.reduce(
    (sum, bucket) => sum + bucket.entries.length,
    0,
  );
  const totalCount = tiers.reduce((sum, bucket) => sum + bucket.entries.length, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-frame/50 bg-surface-2/40 px-3 py-2.5 text-sm text-muted">
        Raw BST ladder vs the Modern Emerald roster — ignores typing, movepool,
        evolution stage, and stat distribution. An S here is{" "}
        <span className="font-semibold text-ink">not</span> a competitive tier.
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs font-bold text-muted">
          Type
          <select
            className={FILTER_SELECT_CLASS}
            value={type ?? ""}
            onChange={(event) => {
              const next = event.target.value;
              setType(
                POKEMON_TYPES.find((entry) => entry === next) ?? null,
              );
            }}
          >
            <option value="">All types</option>
            {POKEMON_TYPES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>

        <div className="flex min-w-0 flex-[2] flex-col gap-1">
          <p className="text-xs font-bold text-muted">Generation</p>
          <div
            role="group"
            aria-label="Generation"
            className="flex flex-wrap items-center gap-1.5"
          >
            <FilterChip
              active={generation == null}
              onClick={() => setGeneration(null)}
            >
              All
            </FilterChip>
            {POKEMON_GENERATIONS.map((g) => (
              <FilterChip
                key={g}
                active={generation === g}
                onClick={() => setGeneration(g)}
              >
                {g}
              </FilterChip>
            ))}
          </div>
        </div>

        <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs font-bold text-muted">
          Ownership
          <select
            className={FILTER_SELECT_CLASS}
            value={ownership}
            onChange={(event) => {
              const next = event.target.value;
              if (
                next === "owned" ||
                next === "mine" ||
                next === "untouched"
              ) {
                setOwnership(next);
                return;
              }
              setOwnership("all");
            }}
          >
            <option value="all">All species</option>
            <option value="owned">Owned in pack</option>
            {myTrainerId ? <option value="mine">Owned by me</option> : null}
            <option value="untouched">Untouched</option>
          </select>
        </label>

        <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            className="size-4 rounded border-frame"
            checked={finalOnly}
            onChange={(event) => setFinalOnly(event.target.checked)}
          />
          Fully evolved only
        </label>
      </div>

      <p className="text-xs text-muted">
        Showing {visibleCount}
        {visibleCount !== totalCount ? ` of ${totalCount}` : ""} Modern Emerald
        species · peer pool {tiers[0]?.peerCount ?? 0}
      </p>

      {filteredBuckets.length === 0 ? (
        <p className="rounded-md border border-frame/40 bg-surface/60 px-4 py-5 text-sm text-muted">
          Nothing matches these filters.
        </p>
      ) : (
        <ul className="space-y-4">
          {filteredBuckets.map((bucket) => (
            <li key={bucket.key} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {bucket.key === "unranked" ? (
                  <span className="inline-flex items-center rounded border border-frame/40 bg-surface-2/70 px-1.5 py-0.5 text-xs font-bold text-muted">
                    Unranked
                  </span>
                ) : (
                  <>
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-bold leading-tight ${statRankToneClass(bucket.key)}`}
                    >
                      {bucket.key}
                    </span>
                    <span className="text-xs font-semibold text-muted">
                      {rankBandLabel(bucket.key)} of roster
                    </span>
                  </>
                )}
                <span className="text-xs tabular-nums text-muted">
                  {bucket.entries.length}
                </span>
              </div>

              {bucket.key === "unranked" ? (
                <p className="text-[11px] text-muted">
                  No catalogued base stats — mostly formes. Not guessed into a
                  letter.
                </p>
              ) : null}

              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                {bucket.entries.map((entry) => {
                  const own = boardById.get(entry.pokedexId);
                  const owned =
                    own?.status === "owned" || Boolean(own?.ownedByMe);
                  return (
                    <li key={entry.pokedexId}>
                      <button
                        type="button"
                        title={
                          entry.rank
                            ? `${entry.species} · BST ${entry.bst} · ${entry.rank}`
                            : `${entry.species} · unranked`
                        }
                        aria-label={`Open ${entry.species} briefing`}
                        onClick={() => onSelectSpecies(entry.pokedexId)}
                        className={`pressable group flex h-full w-full flex-col items-center gap-1 rounded-md border px-1.5 py-2 ${
                          owned
                            ? "border-accent/35 bg-accent/10 hover:border-accent/55"
                            : "border-frame/30 bg-surface/50 hover:border-interactive/40 hover:bg-interactive-soft/40"
                        }`}
                      >
                        <PokemonSpriteImage
                          alt=""
                          className={`pixelated h-12 w-12 object-contain transition-[filter,opacity] duration-150 sm:h-14 sm:w-14 ${
                            owned
                              ? ""
                              : "opacity-55 grayscale-[35%] group-hover:opacity-100 group-hover:grayscale-0"
                          }`}
                          height={56}
                          loading="lazy"
                          pokedexId={entry.pokedexId}
                          species={entry.species}
                          width={56}
                        />
                        <span className="max-w-full truncate text-[10px] font-semibold text-ink">
                          {entry.species}
                        </span>
                        <span className="text-[9px] font-semibold tabular-nums text-muted">
                          {entry.rank
                            ? `BST ${entry.bst}`
                            : `#${String(entry.pokedexId).padStart(3, "0")}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function matchesFilters(
  entry: SpeciesTierEntry,
  options: {
    type: PokemonType | null;
    generation: number | null;
    finalOnly: boolean;
    ownership: OwnershipFilter;
    boardById: Map<
      number,
      { status: SpeciesOwnershipStatus; ownedByMe: boolean }
    >;
    myTrainerId: string | null;
  },
): boolean {
  if (options.generation != null) {
    const catalog = findPokemonById(entry.pokedexId);
    if (!catalog || catalog.generation !== options.generation) return false;
  }
  if (options.type) {
    const types = typesForPokedexId(entry.pokedexId);
    if (!types.includes(options.type)) return false;
  }
  if (options.finalOnly && evolutionsFrom(entry.pokedexId).length > 0) {
    return false;
  }
  const own = options.boardById.get(entry.pokedexId);
  if (options.ownership === "owned") {
    if (own?.status !== "owned") return false;
  } else if (options.ownership === "mine") {
    if (!options.myTrainerId || !own?.ownedByMe) return false;
  } else if (options.ownership === "untouched") {
    if (own?.status !== "untouched") return false;
  }
  return true;
}

function FilterChip({
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
