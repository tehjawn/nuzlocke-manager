"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PokemonHoverPreview } from "@/components/PokemonHoverPreview";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import type { TrainerProfile } from "@/lib/challenge-types";
import {
  competitiveTierBandBlurb,
  competitiveTierFor,
  competitiveTierList,
  competitiveTierMeta,
  type CompetitiveTierEntry,
} from "@/lib/competitive-tiers";
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
  type StatRank,
} from "@/lib/species-ranks";

export type TierLadder = "bst" | "competitive";

type PokedexTierListProps = {
  ladder: TierLadder;
  trainers: TrainerProfile[];
  myTrainerId?: string | null;
  onSelectSpecies: (pokedexId: number) => void;
};

type OwnershipFilter = "all" | "owned" | "mine" | "untouched";

type BoardMap = Map<
  number,
  { status: SpeciesOwnershipStatus; ownedByMe: boolean }
>;

const FILTER_SELECT_CLASS =
  "rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink";

/**
 * Dual ladder over the Modern Emerald roster:
 * - **BST** — objective percentile bands (sprite grid)
 * - **Competitive** — curated nuzlocke viability with a required reason per mon
 */
export function PokedexTierList({
  ladder,
  trainers,
  myTrainerId = null,
  onSelectSpecies,
}: PokedexTierListProps) {
  const [type, setType] = useState<PokemonType | null>(null);
  const [finalOnly, setFinalOnly] = useState(false);
  const [ownership, setOwnership] = useState<OwnershipFilter>("all");
  const [hideUntiered, setHideUntiered] = useState(ladder === "competitive");

  const boardById = useMemo(() => {
    const map: BoardMap = new Map();
    for (const entry of speciesOwnershipBoard(trainers)) {
      map.set(entry.pokedexId, {
        status: entry.status,
        ownedByMe: entry.owners.some((o) => o.trainerId === myTrainerId),
      });
    }
    return map;
  }, [trainers, myTrainerId]);

  const filterOpts = useMemo<FilterOpts>(
    () => ({
      type,
      finalOnly,
      ownership,
      boardById,
      myTrainerId,
    }),
    [type, finalOnly, ownership, boardById, myTrainerId],
  );

  if (ladder === "competitive") {
    return (
      <CompetitiveLadder
        boardById={boardById}
        filterOpts={filterOpts}
        hideUntiered={hideUntiered}
        myTrainerId={myTrainerId}
        onSelectSpecies={onSelectSpecies}
        ownership={ownership}
        setFinalOnly={setFinalOnly}
        setHideUntiered={setHideUntiered}
        setOwnership={setOwnership}
        setType={setType}
        type={type}
        finalOnly={finalOnly}
      />
    );
  }

  return (
    <BstLadder
      boardById={boardById}
      filterOpts={filterOpts}
      myTrainerId={myTrainerId}
      onSelectSpecies={onSelectSpecies}
      ownership={ownership}
      setFinalOnly={setFinalOnly}
      setOwnership={setOwnership}
      setType={setType}
      type={type}
      finalOnly={finalOnly}
    />
  );
}

function BstLadder({
  boardById,
  filterOpts,
  myTrainerId,
  onSelectSpecies,
  ownership,
  setFinalOnly,
  setOwnership,
  setType,
  type,
  finalOnly,
}: {
  boardById: BoardMap;
  filterOpts: FilterOpts;
  myTrainerId: string | null;
  onSelectSpecies: (pokedexId: number) => void;
  ownership: OwnershipFilter;
  setFinalOnly: (v: boolean) => void;
  setOwnership: (v: OwnershipFilter) => void;
  setType: (v: PokemonType | null) => void;
  type: PokemonType | null;
  finalOnly: boolean;
}) {
  const tiers = useMemo(() => speciesTierList(), []);

  const filteredBuckets = useMemo(() => {
    return tiers
      .map((bucket) => ({
        ...bucket,
        entries: bucket.entries.filter((entry) =>
          matchesFilters(entry.pokedexId, filterOpts),
        ),
      }))
      .filter((bucket) => bucket.entries.length > 0);
  }, [tiers, filterOpts]);

  const visibleCount = filteredBuckets.reduce(
    (sum, bucket) => sum + bucket.entries.length,
    0,
  );
  const totalCount = tiers.reduce(
    (sum, bucket) => sum + bucket.entries.length,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-frame/50 bg-surface-2/40 px-3 py-2.5 text-sm text-muted">
        Raw BST ladder vs the Modern Emerald roster — ignores typing, movepool,
        evolution stage, and stat distribution. An S here is{" "}
        <span className="font-semibold text-ink">not</span> a competitive tier.
        Switch to <span className="font-semibold text-ink">Competitive</span> for
        viability-with-reasons.
      </div>

      <TierFilters
        finalOnly={finalOnly}
        myTrainerId={myTrainerId}
        ownership={ownership}
        setFinalOnly={setFinalOnly}
        setOwnership={setOwnership}
        setType={setType}
        type={type}
      />

      <p className="text-xs text-muted">
        Showing {visibleCount}
        {visibleCount !== totalCount ? ` of ${totalCount}` : ""} Modern Emerald
        species · peer pool {tiers[0]?.peerCount ?? 0}
      </p>

      {filteredBuckets.length === 0 ? (
        <EmptyFilters />
      ) : (
        <ul className="space-y-4">
          {filteredBuckets.map((bucket) => (
            <li key={bucket.key} className="space-y-2">
              <TierHeader
                count={bucket.entries.length}
                keyLabel={bucket.key}
                subtitle={
                  bucket.key === "unranked"
                    ? null
                    : `${rankBandLabel(bucket.key)} of roster`
                }
              />
              {bucket.key === "unranked" ? (
                <p className="text-[11px] text-muted">
                  No catalogued base stats — mostly formes. Not guessed into a
                  letter.
                </p>
              ) : null}
              <SpriteGrid
                boardById={boardById}
                entries={bucket.entries}
                onSelectSpecies={onSelectSpecies}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CompetitiveLadder({
  boardById,
  filterOpts,
  hideUntiered,
  myTrainerId,
  onSelectSpecies,
  ownership,
  setFinalOnly,
  setHideUntiered,
  setOwnership,
  setType,
  type,
  finalOnly,
}: {
  boardById: BoardMap;
  filterOpts: FilterOpts;
  hideUntiered: boolean;
  myTrainerId: string | null;
  onSelectSpecies: (pokedexId: number) => void;
  ownership: OwnershipFilter;
  setFinalOnly: (v: boolean) => void;
  setHideUntiered: (v: boolean) => void;
  setOwnership: (v: OwnershipFilter) => void;
  setType: (v: PokemonType | null) => void;
  type: PokemonType | null;
  finalOnly: boolean;
}) {
  const meta = useMemo(() => competitiveTierMeta(), []);
  const tiers = useMemo(() => competitiveTierList(), []);

  const filteredBuckets = useMemo(() => {
    return tiers
      .filter((bucket) => !(hideUntiered && bucket.key === "untiered"))
      .map((bucket) => ({
        ...bucket,
        entries: bucket.entries.filter((entry) =>
          matchesFilters(entry.pokedexId, filterOpts),
        ),
      }))
      .filter((bucket) => bucket.entries.length > 0);
  }, [tiers, filterOpts, hideUntiered]);

  const curatedTotal = tiers
    .filter((b) => b.key !== "untiered")
    .reduce((sum, b) => sum + b.count, 0);
  const visibleCount = filteredBuckets.reduce(
    (sum, bucket) => sum + bucket.entries.length,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-frame/50 bg-surface-2/40 px-3 py-2.5 text-sm text-muted">
        <p className="font-semibold text-ink">{meta.label}</p>
        <p className="mt-1">{meta.blurb}</p>
        <p className="mt-1 text-[11px]">
          {curatedTotal} curated · updated {meta.updated}
        </p>
      </div>

      <TierFilters
        finalOnly={finalOnly}
        myTrainerId={myTrainerId}
        ownership={ownership}
        setFinalOnly={setFinalOnly}
        setOwnership={setOwnership}
        setType={setType}
        type={type}
        trailing={
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className="size-4 rounded border-frame"
              checked={hideUntiered}
              onChange={(event) => setHideUntiered(event.target.checked)}
            />
            Hide untiered
          </label>
        }
      />

      <p className="text-xs text-muted">
        Showing {visibleCount} species
        {hideUntiered ? " (untiered hidden)" : ""}
      </p>

      {filteredBuckets.length === 0 ? (
        <EmptyFilters />
      ) : (
        <ul className="space-y-5">
          {filteredBuckets.map((bucket) => (
            <li key={bucket.key} className="space-y-2">
              <TierHeader
                count={bucket.entries.length}
                keyLabel={bucket.key === "untiered" ? "untiered" : bucket.key}
                subtitle={
                  bucket.key === "untiered"
                    ? "Not curated yet — open the directory, don’t trust a letter"
                    : competitiveTierBandBlurb(bucket.key)
                }
              />
              <CompetitiveSpriteGrid
                boardById={boardById}
                entries={bucket.entries}
                onSelectSpecies={onSelectSpecies}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CompetitiveSpriteGrid({
  boardById,
  entries,
  onSelectSpecies,
}: {
  boardById: BoardMap;
  entries: CompetitiveTierEntry[];
  onSelectSpecies: (pokedexId: number) => void;
}) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
      {entries.map((entry) => {
        const own = boardById.get(entry.pokedexId);
        const owned = own?.status === "owned" || Boolean(own?.ownedByMe);
        const subtitle =
          entry.tier != null
            ? `Comp ${entry.tier}`
            : "Untiered — not curated yet";
        return (
          <li key={entry.pokedexId}>
            <PokemonHoverPreview
              className="h-full"
              speciesPreview={{
                species: entry.species,
                pokedexId: entry.pokedexId,
                subtitle,
                detail: entry.reason ?? undefined,
              }}
            >
              <button
                type="button"
                aria-label={
                  entry.reason
                    ? `Open ${entry.species} in Directory. ${subtitle}: ${entry.reason}`
                    : `Open ${entry.species} in Directory. ${subtitle}`
                }
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
                  {entry.tier != null
                    ? `Comp ${entry.tier}`
                    : `#${String(entry.pokedexId).padStart(3, "0")}`}
                </span>
              </button>
            </PokemonHoverPreview>
          </li>
        );
      })}
    </ul>
  );
}

function SpriteGrid({
  boardById,
  entries,
  onSelectSpecies,
}: {
  boardById: BoardMap;
  entries: SpeciesTierEntry[];
  onSelectSpecies: (pokedexId: number) => void;
}) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
      {entries.map((entry) => {
        const own = boardById.get(entry.pokedexId);
        const owned = own?.status === "owned" || Boolean(own?.ownedByMe);
        return (
          <li key={entry.pokedexId}>
            <button
              type="button"
              title={
                entry.rank
                  ? `${entry.species} · BST ${entry.bst} · ${entry.rank}`
                  : `${entry.species} · unranked`
              }
              aria-label={`Open ${entry.species} in Directory`}
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
  );
}

function TierHeader({
  keyLabel,
  subtitle,
  count,
}: {
  keyLabel: StatRank | "unranked" | "untiered";
  subtitle: string | null;
  count: number;
}) {
  const isLetter = keyLabel !== "unranked" && keyLabel !== "untiered";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isLetter ? (
        <span
          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-bold leading-tight ${statRankToneClass(keyLabel)}`}
        >
          {keyLabel}
        </span>
      ) : (
        <span className="inline-flex items-center rounded border border-frame/40 bg-surface-2/70 px-1.5 py-0.5 text-xs font-bold capitalize text-muted">
          {keyLabel}
        </span>
      )}
      {subtitle ? (
        <span className="text-xs font-semibold text-muted">{subtitle}</span>
      ) : null}
      <span className="text-xs tabular-nums text-muted">{count}</span>
    </div>
  );
}

function TierFilters({
  type,
  setType,
  ownership,
  setOwnership,
  finalOnly,
  setFinalOnly,
  myTrainerId,
  trailing,
}: {
  type: PokemonType | null;
  setType: (v: PokemonType | null) => void;
  ownership: OwnershipFilter;
  setOwnership: (v: OwnershipFilter) => void;
  finalOnly: boolean;
  setFinalOnly: (v: boolean) => void;
  myTrainerId: string | null;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs font-bold text-muted">
        Type
        <select
          className={FILTER_SELECT_CLASS}
          value={type ?? ""}
          onChange={(event) => {
            const next = event.target.value;
            setType(POKEMON_TYPES.find((entry) => entry === next) ?? null);
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

      <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs font-bold text-muted">
        Ownership
        <select
          className={FILTER_SELECT_CLASS}
          value={ownership}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "owned" || next === "mine" || next === "untouched") {
              setOwnership(next);
              return;
            }
            setOwnership("all");
          }}
        >
          <option value="all">All species</option>
          <option value="owned">Owned by trainer</option>
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

      {trailing}
    </div>
  );
}

function EmptyFilters() {
  return (
    <p className="rounded-md border border-frame/40 bg-surface/60 px-4 py-5 text-sm text-muted">
      Nothing matches these filters.
    </p>
  );
}

type FilterOpts = {
  type: PokemonType | null;
  finalOnly: boolean;
  ownership: OwnershipFilter;
  boardById: BoardMap;
  myTrainerId: string | null;
};

function matchesFilters(pokedexId: number, options: FilterOpts): boolean {
  if (options.type) {
    const types = typesForPokedexId(pokedexId);
    if (!types.includes(options.type)) return false;
  }
  if (options.finalOnly && evolutionsFrom(pokedexId).length > 0) {
    return false;
  }
  const own = options.boardById.get(pokedexId);
  if (options.ownership === "owned") {
    if (own?.status !== "owned") return false;
  } else if (options.ownership === "mine") {
    if (!options.myTrainerId || !own?.ownedByMe) return false;
  } else if (options.ownership === "untouched") {
    if (own?.status !== "untouched") return false;
  }
  return true;
}

/** Briefing strip — only when curated. */
export function CompetitiveTierBrief({
  pokedexId,
}: {
  pokedexId: number;
}) {
  const entry = competitiveTierFor(pokedexId);
  if (!entry?.tier || !entry.reason) return null;
  return (
    <div className="rounded-md border border-frame/40 bg-surface-2/50 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
          Competitive
        </span>
        <span
          className={`inline-flex items-center rounded border px-1 py-0.5 text-[10px] font-bold leading-tight ${statRankToneClass(entry.tier)}`}
        >
          {entry.tier}
        </span>
      </div>
      <p className="mt-1 text-xs leading-snug text-muted">{entry.reason}</p>
    </div>
  );
}
