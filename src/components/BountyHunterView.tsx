"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ModeTabs } from "@/components/ModeTabs";
import { PokemonHoverPreview } from "@/components/PokemonHoverPreview";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { Skeleton } from "@/components/Skeleton";
import { SpecimenShowcase } from "@/components/SpecimenShowcase";
import type { TrainerProfile } from "@/lib/challenge-types";
import {
  exclusiveOwnedSpecies,
  formatHolderHandles,
  groupExclusivesByLine,
  personalSpeciesStatus,
  speciesOwnershipBoard,
  type ExclusiveLineGroup,
  type ExclusiveSpecies,
  type SpeciesOwnershipEntry,
  type SpeciesOwnershipStatus,
} from "@/lib/encounter-stats";
import { seasonSpecimenBoard, type SpecimenSort } from "@/lib/specimen-board";
import {
  parseBountyMode,
  toolsHref,
  type BountyMode,
} from "@/lib/tools-routes";
import {
  InfiniteRevealFooter,
  useInfiniteReveal,
} from "@/lib/use-infinite-reveal";
import { useToolsEncounteredStubs } from "@/lib/use-tools-encountered-stubs";

type BountyHunterViewProps = {
  slug: string;
  trainers: TrainerProfile[];
  myTrainerId?: string | null;
  /**
   * Trainers whose IVs / EVs survived redaction. Gates the numbers in the
   * Showcase details modal only — tier chrome is public season-wide.
   */
  competitiveTrainerIds?: string[];
  /**
   * False while Ownership grade stamps are still hydrating (#367). Tracker /
   * exclusives stay interactive; Showcase waits so catch/bond chrome doesn't
   * flash empty.
   */
  gradesReady?: boolean;
  initialMode?: BountyMode | null;
};

type StatusFilter = "all" | SpeciesOwnershipStatus;
type ExclusiveLineFilter = "all" | "whole" | "split" | "partial";
/**
 * One control drives three boards, so the union is the superset. `MODE_SORTS`
 * below is the source of truth for which options a mode actually offers, and
 * `selectMode` resets anything the next mode can't honour.
 */
type SortMode = "dex" | "rarity" | "alpha" | SpecimenSort;
type BoardRow = {
  entry: SpeciesOwnershipEntry;
  status: SpeciesOwnershipStatus;
};

const MODES: ReadonlyArray<{ id: BountyMode; label: string }> = [
  { id: "tracker", label: "Species tracker" },
  { id: "exclusives", label: "Exclusives" },
  { id: "showcase", label: "Showcase" },
];

const MODE_SORTS: Record<
  BountyMode,
  ReadonlyArray<{ id: SortMode; label: string }>
> = {
  tracker: [
    { id: "dex", label: "Dex order" },
    { id: "rarity", label: "Rarity" },
    { id: "alpha", label: "A–Z" },
  ],
  exclusives: [
    { id: "dex", label: "Dex order" },
    { id: "alpha", label: "A–Z" },
  ],
  showcase: [
    { id: "dex", label: "Dex order" },
    { id: "level", label: "Level (high → low)" },
    { id: "catch", label: "Catch tier (best first)" },
    { id: "training", label: "Bond (closest first)" },
    { id: "bst", label: "BST score (best first)" },
    { id: "competitive", label: "Comp score (best first)" },
    { id: "trainer", label: "Trainer" },
    { id: "alpha", label: "A–Z" },
  ],
};

/** Showcase reads the same `dex` / `alpha` ids the other modes use. */
function specimenSortFor(sort: SortMode): SpecimenSort {
  return sort === "rarity" ? "dex" : sort;
}

const STATUS_FILTERS: ReadonlyArray<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "owned", label: "Owned" },
  { id: "encountered", label: "Encountered" },
  { id: "untouched", label: "Untouched" },
];

const EXCLUSIVE_LINE_FILTERS: ReadonlyArray<{
  id: ExclusiveLineFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "whole", label: "Owns the whole line" },
  { id: "split", label: "Split across trainers" },
  { id: "partial", label: "Partial line" },
];

/** Color key for the tracker grid — same tones as the species cards. */
const STATUS_LEGEND: ReadonlyArray<{
  id: SpeciesOwnershipStatus;
  label: string;
  hint: string;
}> = [
  { id: "owned", label: "Owned", hint: "Currently held" },
  { id: "encountered", label: "Encountered", hint: "Seen or lost" },
  { id: "untouched", label: "Untouched", hint: "Not owned yet" },
];

/**
 * Renders the **Pokémon Ownership** tool (`?tool=bounty` — the route id keeps
 * the old name so existing links and Search ids stay valid).
 *
 * Species-status tracker (owned vs. encountered vs. untouched, any trainer
 * or one) plus pack exclusives grouped by evolution line. "Open bounties"
 * and "My gaps" from the old 3-mode UI are now the tracker filtered by
 * status + trainer instead of separate tabs.
 *
 * Showcase drops an altitude: the first two modes answer "which *species* does
 * the pack have?", Showcase answers "which *actual Pokémon* exist right now?"
 */
export function BountyHunterView({
  slug,
  trainers: ownedTrainers,
  myTrainerId = null,
  competitiveTrainerIds = [],
  gradesReady = true,
  initialMode = "tracker",
}: BountyHunterViewProps) {
  const [mode, setMode] = useState<BountyMode>(parseBountyMode(initialMode));
  const [viewerId, setViewerId] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [lineFilter, setLineFilter] = useState<ExclusiveLineFilter>("all");
  // Showcase is a catch-quality browser first — open on catch tier, not dex #.
  const [sort, setSort] = useState<SortMode>(
    parseBountyMode(initialMode) === "showcase" ? "catch" : "dex",
  );
  const [query, setQuery] = useState("");

  const seen = useToolsEncounteredStubs(slug, mode === "tracker");
  const trainers = seen.withStubs(ownedTrainers);

  const board = useMemo(() => speciesOwnershipBoard(trainers), [trainers]);
  const exclusives = useMemo(
    () => exclusiveOwnedSpecies(ownedTrainers),
    [ownedTrainers],
  );
  const specimens = useMemo(
    () => seasonSpecimenBoard(ownedTrainers),
    [ownedTrainers],
  );

  function selectMode(next: BountyMode) {
    setMode(next);
    // Showcase defaults to catch-tier sort; other modes fall back to dex when
    // the current sort isn't in that mode's vocabulary.
    if (next === "showcase") {
      setSort("catch");
    } else if (!MODE_SORTS[next].some((option) => option.id === sort)) {
      setSort("dex");
    }
    // Keep the shareable ?mode= URL without a tools-route RSC refetch.
    const url = new URL(window.location.href);
    url.searchParams.set("tool", "bounty");
    url.searchParams.set("mode", next);
    window.history.replaceState(window.history.state, "", url.href);
  }

  const q = query.trim().toLowerCase();

  const scopedBoard = useMemo<BoardRow[]>(
    () =>
      board.map((entry) => ({
        entry,
        status: viewerId
          ? personalSpeciesStatus(entry, viewerId)
          : entry.status,
      })),
    [board, viewerId],
  );

  const queryRows = useMemo(
    () =>
      q
        ? scopedBoard.filter(
            ({ entry }) =>
              entry.species.toLowerCase().includes(q) ||
              String(entry.pokedexId).includes(q),
          )
        : scopedBoard,
    [scopedBoard, q],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<SpeciesOwnershipStatus, number> = {
      owned: 0,
      encountered: 0,
      untouched: 0,
    };
    for (const row of queryRows) counts[row.status] += 1;
    return counts;
  }, [queryRows]);

  const visibleBoard = useMemo(() => {
    const filtered =
      statusFilter === "all"
        ? queryRows
        : queryRows.filter(({ status }) => status === statusFilter);
    return [...filtered].sort((a, b) => {
      if (sort === "alpha")
        return a.entry.species.localeCompare(b.entry.species);
      if (sort === "rarity" && a.entry.totalSeen !== b.entry.totalSeen) {
        return a.entry.totalSeen - b.entry.totalSeen;
      }
      return a.entry.pokedexId - b.entry.pokedexId;
    });
  }, [queryRows, statusFilter, sort]);

  const exclusiveGroups = useMemo(() => {
    // Group the full pack first so line-completeness sees every trainer's
    // stages; only then filter groups for the selected viewer / search.
    let groups = groupExclusivesByLine(exclusives);
    if (viewerId) {
      groups = groups.filter((group) =>
        group.entries.some((entry) => entry.trainerId === viewerId),
      );
    }
    if (q) {
      groups = groups.filter(
        (group) =>
          group.rootSpecies.toLowerCase().includes(q) ||
          group.entries.some(
            (entry) =>
              entry.species.toLowerCase().includes(q) ||
              entry.trainerHandle.toLowerCase().includes(q) ||
              String(entry.pokedexId).includes(q),
          ),
      );
    }
    if (sort === "alpha") {
      groups = [...groups].sort((a, b) =>
        a.rootSpecies.localeCompare(b.rootSpecies),
      );
    }
    return groups;
  }, [exclusives, viewerId, q, sort]);

  const exclusiveLineCounts = useMemo(() => {
    const counts: Record<ExclusiveLineFilter, number> = {
      all: exclusiveGroups.length,
      whole: 0,
      split: 0,
      partial: 0,
    };
    for (const group of exclusiveGroups) {
      counts[exclusiveLineKind(group)] += 1;
    }
    return counts;
  }, [exclusiveGroups]);

  const visibleExclusiveGroups = useMemo(() => {
    if (lineFilter === "all") return exclusiveGroups;
    return exclusiveGroups.filter(
      (group) => exclusiveLineKind(group) === lineFilter,
    );
  }, [exclusiveGroups, lineFilter]);

  return (
    <ModeTabs
      aria-label="Pokémon Ownership modes"
      idPrefix="ownership"
      size="sm"
      value={mode}
      tabs={MODES}
      onValueChange={selectMode}
      panelClassName="space-y-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[12rem] flex-1 space-y-1 text-xs font-semibold text-muted">
          Search
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              mode === "showcase"
                ? "Species, nickname, trainer, route…"
                : "Species, dex #…"
            }
            className="w-full rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink"
          />
        </label>
        <label className="min-w-[10rem] space-y-1 text-xs font-semibold text-muted">
          Trainer
          <select
            value={viewerId}
            onChange={(event) => setViewerId(event.target.value)}
            className="w-full rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink"
          >
            <option value="">All trainers</option>
            {trainers.map((trainer) => (
              <option key={trainer.id} value={trainer.id}>
                {trainer.handle}
                {trainer.id === myTrainerId ? " (you)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[9rem] space-y-1 text-xs font-semibold text-muted">
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
            className="w-full rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink"
          >
            {MODE_SORTS[mode].map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {mode === "tracker" ? (
        !seen.ready ? (
          <div
            className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8"
            aria-busy="true"
            aria-label="Loading encounter stubs"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <Skeleton
                key={i}
                className="aspect-square rounded-lg border border-frame/40 bg-surface"
              />
            ))}
          </div>
        ) : (
        <>
          <StatusLegend />

          <div
            role="group"
            aria-label="Status filter"
            className="flex flex-wrap gap-1.5"
          >
            {STATUS_FILTERS.map((entry) => {
              const active = statusFilter === entry.id;
              const count =
                entry.id === "all" ? queryRows.length : statusCounts[entry.id];
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(entry.id)}
                  className={`pressable rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    active
                      ? statusChipActiveClass(entry.id)
                      : "border-frame/50 bg-surface text-muted hover:bg-surface/80"
                  }`}
                >
                  {entry.label} · {count}
                </button>
              );
            })}
          </div>

          <SpeciesGrid
            slug={slug}
            rows={visibleBoard}
            resetKey={`${statusFilter}|${sort}|${q}|${viewerId}`}
            viewerScoped={Boolean(viewerId)}
            emptyMessage={
              q || statusFilter !== "all"
                ? "Nothing matches these filters."
                : "No Modern Emerald species data yet."
            }
          />
        </>
        )
      ) : mode === "showcase" ? (
        gradesReady ? (
          <SpecimenShowcase
            competitiveTrainerIds={competitiveTrainerIds}
            query={q}
            rows={specimens}
            slug={slug}
            sort={specimenSortFor(sort)}
            trainerId={viewerId || null}
          />
        ) : (
          <div
            className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8"
            aria-busy="true"
            aria-label="Loading catch grades"
          >
            {Array.from({ length: 16 }, (_, i) => (
              <Skeleton
                key={i}
                className="aspect-square rounded-lg border border-frame/40 bg-surface"
              />
            ))}
          </div>
        )
      ) : (
        <>
          <div
            role="group"
            aria-label="Exclusive line filter"
            className="flex flex-wrap gap-1.5"
          >
            {EXCLUSIVE_LINE_FILTERS.map((entry) => {
              const active = lineFilter === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setLineFilter(entry.id)}
                  className={`pressable rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    active
                      ? exclusiveLineChipActiveClass(entry.id)
                      : "border-frame/50 bg-surface text-muted hover:bg-surface/80"
                  }`}
                >
                  {entry.label} · {exclusiveLineCounts[entry.id]}
                </button>
              );
            })}
          </div>

          <ExclusiveLineGroups
            slug={slug}
            groups={visibleExclusiveGroups}
            total={exclusives.length}
            viewerScoped={Boolean(viewerId)}
            filtered={lineFilter !== "all" || Boolean(q) || Boolean(viewerId)}
          />
        </>
      )}
    </ModeTabs>
  );
}

function exclusiveLineKind(
  group: ExclusiveLineGroup,
): Exclude<ExclusiveLineFilter, "all"> {
  if (group.singleTrainer) return "whole";
  if (new Set(group.entries.map((entry) => entry.trainerId)).size > 1) {
    return "split";
  }
  return "partial";
}

function exclusiveLineChipActiveClass(filter: ExclusiveLineFilter): string {
  if (filter === "whole") {
    return "border-accent/40 bg-accent/15 text-accent-deep shadow-sm";
  }
  return "border-interactive/40 bg-interactive-soft text-ink shadow-sm";
}

function StatusLegend() {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Species status legend">
      {STATUS_LEGEND.map((item) => (
        <li key={item.id}>
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold ${statusLegendClass(item.id)}`}
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-sm ${statusSwatchClass(item.id)}`}
              aria-hidden
            />
            <span>{item.label}</span>
            <span className="font-medium opacity-70">· {item.hint}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function statusLegendClass(status: SpeciesOwnershipStatus): string {
  if (status === "owned") {
    return "border-accent/35 bg-accent/10 text-accent-deep";
  }
  if (status === "encountered") {
    // Theme tokens only — no Tailwind `dark:` (prefers-color-scheme ≠ [data-theme]).
    return "border-accent-2/45 bg-accent-2/15 text-ink";
  }
  return "border-frame/40 bg-surface/60 text-muted";
}

function statusSwatchClass(status: SpeciesOwnershipStatus): string {
  if (status === "owned") return "bg-accent";
  if (status === "encountered") return "bg-accent-2";
  return "bg-ink/25";
}

function statusChipActiveClass(status: StatusFilter): string {
  if (status === "owned") {
    return "border-accent/40 bg-accent/15 text-accent-deep shadow-sm";
  }
  if (status === "encountered") {
    return "border-accent-2/45 bg-accent-2/15 text-ink shadow-sm";
  }
  if (status === "untouched") {
    return "border-frame bg-ink/10 text-muted shadow-sm";
  }
  return "border-interactive/40 bg-interactive-soft text-ink shadow-sm";
}

function statusSubtitle(row: BoardRow, viewerScoped: boolean): string {
  if (viewerScoped) {
    if (row.status === "owned") return "You own this";
    if (row.status === "encountered") return "You've seen this";
    return "Not yet";
  }
  if (row.status === "owned") {
    return `Owned · ${formatHolderHandles(row.entry.owners)}`;
  }
  if (row.status === "encountered") {
    return `Encountered · ${formatHolderHandles(row.entry.encounteredBy)}`;
  }
  return "Not owned yet";
}

function SpeciesGrid({
  slug,
  rows,
  resetKey,
  viewerScoped,
  emptyMessage,
}: {
  slug: string;
  rows: BoardRow[];
  resetKey: string;
  viewerScoped: boolean;
  emptyMessage: string;
}) {
  const {
    visible,
    hasMore,
    remaining,
    sentinelRef,
    loadMore,
  } = useInfiniteReveal(rows, resetKey, { pageSize: 96, root: "viewport" });

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-frame/40 bg-surface/60 px-4 py-5 text-sm text-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
      {visible.map((row) => (
        <li key={row.entry.pokedexId}>
          <PokemonHoverPreview
            className="h-full"
            speciesPreview={{
              species: row.entry.species,
              pokedexId: row.entry.pokedexId,
              subtitle: statusSubtitle(row, viewerScoped),
            }}
          >
            <Link
              href={toolsHref(slug, "pokedex", { id: row.entry.pokedexId })}
              title={row.entry.species}
              aria-label={`${row.entry.species} (#${String(row.entry.pokedexId).padStart(3, "0")})`}
              className={`pressable group flex h-full flex-col items-center gap-1 rounded-md border px-1.5 py-2 ${statusCardClass(row.status)}`}
            >
              <PokemonSpriteImage
                alt=""
                className={`pixelated h-12 w-12 object-contain transition-[filter,opacity] duration-150 sm:h-14 sm:w-14 ${
                  row.status === "untouched"
                    ? "opacity-55 grayscale-[35%] group-hover:opacity-100 group-hover:grayscale-0"
                    : ""
                }`}
                height={56}
                pokedexId={row.entry.pokedexId}
                species={row.entry.species}
                width={56}
              />
              <span className="max-w-full truncate text-[10px] font-semibold text-ink">
                {row.entry.species}
              </span>
              <span className="text-[9px] font-semibold tabular-nums text-muted">
                #{String(row.entry.pokedexId).padStart(3, "0")}
              </span>
            </Link>
          </PokemonHoverPreview>
        </li>
      ))}
      <InfiniteRevealFooter
        hasMore={hasMore}
        remaining={remaining}
        sentinelRef={sentinelRef}
        onLoadMore={loadMore}
      />
    </ul>
  );
}

function statusCardClass(status: SpeciesOwnershipStatus): string {
  if (status === "owned") {
    return "border-accent/35 bg-accent/10 hover:border-accent/55 hover:bg-accent/15";
  }
  if (status === "encountered") {
    return "border-accent-2/45 bg-accent-2/15 hover:border-accent-2/60 hover:bg-accent-2/20";
  }
  return "border-frame/30 bg-surface/50 hover:border-interactive/40 hover:bg-interactive-soft/40";
}

function ExclusiveLineGroups({
  slug,
  groups,
  total,
  viewerScoped,
  filtered,
}: {
  slug: string;
  groups: ExclusiveLineGroup[];
  total: number;
  viewerScoped: boolean;
  filtered: boolean;
}) {
  const shownCount = groups.reduce((sum, g) => sum + g.entries.length, 0);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Exclusives · {shownCount}
        {shownCount !== total ? ` of ${total}` : ""} pack monopolies across{" "}
        {groups.length} line{groups.length === 1 ? "" : "s"}
      </p>
      {groups.length === 0 ? (
        <p className="rounded-md border border-frame/40 bg-surface/60 px-4 py-5 text-sm text-muted">
          {filtered
            ? "Nothing matches these filters."
            : viewerScoped
              ? "This trainer has no exclusives right now."
              : "No exclusives right now — every living species is shared or untouched."}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {groups.map((group) => {
            const kind = exclusiveLineKind(group);
            const multiTrainer = kind === "split";
            return (
              <li
                key={group.rootPokedexId}
                className="overflow-hidden rounded-lg border border-frame/40 bg-surface/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-frame/30 bg-surface-2/60 px-3 py-2">
                  <p className="text-sm font-semibold text-ink">
                    {group.rootSpecies} line
                    {group.entries.length > 1 && (
                      <span className="ml-1.5 font-normal text-muted">
                        · {group.entries.length} stage
                        {group.entries.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </p>
                  {kind === "whole" ? (
                    <span className="rounded-full border border-accent/35 bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent-deep">
                      {group.entries[0]!.trainerHandle} owns the whole line
                    </span>
                  ) : kind === "split" ? (
                    <span className="rounded-full border border-frame/50 bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted">
                      Split across trainers
                    </span>
                  ) : (
                    <span className="rounded-full border border-frame/50 bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted">
                      Partial line
                    </span>
                  )}
                </div>
                <ul className="grid grid-cols-3 gap-2 p-2.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                  {group.entries.map((entry) => (
                    <li key={`${entry.pokedexId}-${entry.trainerId}`}>
                      <ExclusiveCard
                        slug={slug}
                        entry={entry}
                        showHandle={multiTrainer}
                      />
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ExclusiveCard({
  slug,
  entry,
  showHandle,
}: {
  slug: string;
  entry: ExclusiveSpecies;
  showHandle: boolean;
}) {
  return (
    <PokemonHoverPreview
      className="h-full"
      speciesPreview={{
        species: entry.species,
        pokedexId: entry.pokedexId,
        subtitle: `Only ${entry.trainerHandle}`,
      }}
    >
      <Link
        href={`/challenges/${slug}/trainers/${entry.trainerId}`}
        title={`${entry.species} · only ${entry.trainerHandle}`}
        aria-label={`${entry.species}, only ${entry.trainerHandle}`}
        className="pressable flex h-full flex-col items-center gap-1 rounded-md border border-frame/30 bg-surface/50 px-1.5 py-2 hover:border-interactive/40 hover:bg-interactive-soft/40"
      >
        <PokemonSpriteImage
          alt=""
          className="pixelated h-12 w-12 object-contain sm:h-14 sm:w-14"
          height={56}
          pokedexId={entry.pokedexId}
          species={entry.species}
          width={56}
        />
        <span className="max-w-full truncate text-[10px] font-semibold leading-tight text-ink">
          {entry.species}
        </span>
        <span className="max-w-full truncate text-[9px] leading-tight text-muted">
          #{String(entry.pokedexId).padStart(3, "0")}
          {showHandle ? ` · ${entry.trainerHandle}` : ""}
        </span>
      </Link>
    </PokemonHoverPreview>
  );
}
