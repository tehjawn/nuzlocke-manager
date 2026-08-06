"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { Frame } from "@/components/Frame";
import { MemorialCauseEditor } from "@/components/MemorialCauseEditor";
import { Modal } from "@/components/Modal";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { StatBlock } from "@/components/SeasonStatCards";
import { POKEMON_GENERATIONS } from "@/data/pokemon-index";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import type {
  CrossRunGravesResult,
  MemorialGrave,
} from "@/lib/memorial-backfill";
import { memorialPokemonMatchesFilters } from "@/lib/memorial-stats";
import { POKEMON_TYPES, type PokemonType } from "@/lib/pokemon-types";
import { displayName } from "@/lib/trainer-display";

type MemorialBoardProps = {
  slug: string;
  trainers: TrainerProfile[];
  /** Trainer IDs the viewer may edit causes for (owner / GM with lens). */
  editableTrainerIds?: string[];
  /** Cross-run graves per trainer: live rows + graves recovered from history. */
  gravesByTrainerId: Record<string, CrossRunGravesResult>;
};

type TrainerGraveRow = {
  trainer: TrainerProfile;
  all: MemorialGrave[];
  graves: MemorialGrave[];
  recovered: number;
};

/** Newest attempt first — matches the trainer history accordion. */
function groupByRun(
  graves: MemorialGrave[],
): Array<{ runNumber: number; graves: MemorialGrave[] }> {
  const byRun = new Map<number, MemorialGrave[]>();
  for (const grave of graves) {
    const bucket = byRun.get(grave.runNumber);
    if (bucket) bucket.push(grave);
    else byRun.set(grave.runNumber, [grave]);
  }
  return [...byRun.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([runNumber, runGraves]) => ({ runNumber, graves: runGraves }));
}

/** Highest run, then highest partyIndex — a “latest loss” teaser. */
function latestGrave(graves: MemorialGrave[]): MemorialGrave | null {
  if (graves.length === 0) return null;
  return [...graves].sort((a, b) => {
    if (b.runNumber !== a.runNumber) return b.runNumber - a.runNumber;
    return b.pokemon.partyIndex - a.pokemon.partyIndex;
  })[0]!;
}

/**
 * Filterable cross-run grave browser. Season Stats owns the page chrome and
 * memorial highlight cards (#288) — denser player cards open a RIP modal (#296).
 */
export function MemorialBoard({
  slug,
  trainers,
  editableTrainerIds = [],
  gravesByTrainerId,
}: MemorialBoardProps) {
  const editable = new Set(editableTrainerIds);
  const [typeFilter, setTypeFilter] = useState<PokemonType[]>([]);
  const [generationFilter, setGenerationFilter] = useState<number[]>([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(
    null,
  );

  const filters = { types: typeFilter, generations: generationFilter };
  const filtering = typeFilter.length > 0 || generationFilter.length > 0;

  const allByTrainer: TrainerGraveRow[] = trainers.map((trainer) => {
    const all = gravesByTrainerId[trainer.id]?.graves ?? [];
    return {
      trainer,
      all,
      graves: all.filter((grave) =>
        memorialPokemonMatchesFilters(grave.pokemon, filters),
      ),
      recovered: gravesByTrainerId[trainer.id]?.recoveredCount ?? 0,
    };
  });

  const byTrainer = allByTrainer.filter((row) => row.graves.length > 0);

  const filteredGraveCount = byTrainer.reduce(
    (sum, row) => sum + row.graves.length,
    0,
  );
  const totalGraves = allByTrainer.reduce(
    (sum, row) => sum + row.all.length,
    0,
  );
  const trainersWithLosses = allByTrainer.filter(
    (row) => row.all.length > 0,
  ).length;
  const recoveredCount = allByTrainer.reduce(
    (sum, row) => sum + row.recovered,
    0,
  );
  const hasAnyGraves = totalGraves > 0;

  const selectedRow =
    selectedTrainerId == null
      ? null
      : (byTrainer.find((row) => row.trainer.id === selectedTrainerId) ?? null);

  // Drop the modal if filters hide the open trainer’s remaining graves.
  useEffect(() => {
    if (selectedTrainerId != null && selectedRow == null) {
      setSelectedTrainerId(null);
    }
  }, [selectedTrainerId, selectedRow]);

  function clearFilters() {
    setTypeFilter([]);
    setGenerationFilter([]);
  }

  const trainersMatching = byTrainer.length;

  return (
    <div className="space-y-4">
      <div
        className={`grid gap-2 ${
          recoveredCount > 0
            ? "grid-cols-2 sm:grid-cols-3"
            : "grid-cols-2"
        }`}
      >
        <StatBlock
          icon={<GraveStatIcon />}
          value={String(filtering ? filteredGraveCount : totalGraves)}
          label={filtering ? "Shown" : "Memorialized"}
          hint={
            filtering
              ? `of ${totalGraves} memorialized`
              : "Losses across every run"
          }
        />
        <StatBlock
          icon={<TrainersStatIcon />}
          value={String(filtering ? trainersMatching : trainersWithLosses)}
          label="Trainers with losses"
          hint={
            filtering
              ? "Matching current filters"
              : "At least one RIP this season"
          }
        />
        {recoveredCount > 0 ? (
          <StatBlock
            icon={<HistoryStatIcon />}
            value={String(recoveredCount)}
            label="From history"
            hint="Recovered from wiped board snapshots"
          />
        ) : null}
      </div>

      {hasAnyGraves ? (
        <div className="relative z-20 flex flex-wrap items-end gap-2">
          <MultiSelectFilter
            label="Type"
            emptyLabel="All types"
            options={POKEMON_TYPES.map((type) => ({
              value: type,
              label: type,
            }))}
            selected={typeFilter}
            onChange={setTypeFilter}
          />
          <MultiSelectFilter
            label="Generation"
            emptyLabel="All gens"
            options={POKEMON_GENERATIONS.map((g) => ({
              value: g,
              label: `Gen ${g}`,
            }))}
            selected={generationFilter}
            onChange={setGenerationFilter}
            formatSelected={(values) =>
              values.length === 0
                ? "All gens"
                : values.map((g) => `Gen ${g}`).join(", ")
            }
          />
          {filtering ? (
            <button
              type="button"
              className="pb-2 text-xs font-semibold text-interactive underline-offset-2 hover:underline"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {!hasAnyGraves ? (
        <Frame title="R.I.P." tone="rip">
          <p className="text-sm text-muted">
            No graves yet. May it stay that way — or at least stay interesting.
          </p>
        </Frame>
      ) : filteredGraveCount === 0 ? (
        <Frame title="R.I.P." tone="rip">
          <p className="text-sm text-muted">
            No memorials match these filters.{" "}
            <button
              type="button"
              className="font-semibold text-interactive underline-offset-2 hover:underline"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </p>
        </Frame>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {byTrainer.map((row) => {
            const { trainer, graves, all } = row;
            const wipes = trainer.wipeCount ?? 0;
            const teaser = latestGrave(graves);
            const teaserLabel = teaser
              ? teaser.pokemon.nickname || teaser.pokemon.species
              : null;
            return (
              <li key={trainer.id} className="min-h-0">
                <button
                  type="button"
                  className="pressable flex h-full w-full flex-col gap-1.5 rounded-md border border-frame/40 bg-surface/60 p-2 text-left transition-colors hover:border-interactive/40 hover:bg-interactive-soft/25 sm:p-2.5"
                  onClick={() => setSelectedTrainerId(trainer.id)}
                  aria-label={
                    filtering
                      ? `${displayName(trainer)}: ${graves.length} of ${all.length} RIP${wipes > 0 ? `, ${wipes} wipe${wipes === 1 ? "" : "s"}` : ""}`
                      : `${displayName(trainer)}: ${graves.length} RIP${wipes > 0 ? `, ${wipes} wipe${wipes === 1 ? "" : "s"}` : ""}`
                  }
                >
                  <div className="flex items-stretch gap-1.5">
                    <div className="flex flex-1 items-center justify-center rounded-md bg-surface/80 py-0.5">
                      <AvatarPortrait
                        avatarSpriteKey={trainer.avatarSpriteKey}
                        backgroundKey={trainer.avatarBackgroundKey}
                        sizeClass="h-14 w-14"
                        width={56}
                        height={56}
                        alt=""
                      />
                    </div>
                    <div className="flex flex-1 items-center justify-center rounded-md bg-surface/80 py-0.5">
                      {teaser ? (
                        <PokemonSpriteImage
                          alt=""
                          className="pixelated h-14 w-14 object-contain"
                          height={56}
                          pokedexId={teaser.pokemon.pokedexId}
                          shiny={teaser.pokemon.isShiny}
                          species={teaser.pokemon.species}
                          width={56}
                        />
                      ) : (
                        <span className="text-[11px] font-semibold text-muted/60">
                          —
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="font-display truncate text-xs font-bold leading-tight sm:text-sm">
                      {displayName(trainer)}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] leading-snug text-muted">
                      {teaserLabel
                        ? `Latest · ${teaserLabel}${teaser?.pokemon.isShiny ? " ✦" : ""}`
                        : "No matching graves"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-md bg-surface/80 px-2 py-1.5">
                      <p className="font-display text-xl font-bold tabular-nums leading-none tracking-tight sm:text-2xl">
                        {filtering ? (
                          <>
                            {graves.length}
                            <span className="text-sm font-semibold text-muted">
                              /{all.length}
                            </span>
                          </>
                        ) : (
                          graves.length
                        )}
                      </p>
                      <p className="mt-0.5 text-[9px] font-bold tracking-wide text-muted uppercase">
                        RIP
                      </p>
                    </div>
                    <div className="rounded-md bg-surface/80 px-2 py-1.5">
                      <p
                        className={`font-display text-xl font-bold tabular-nums leading-none tracking-tight sm:text-2xl ${
                          wipes > 0 ? "" : "text-muted/40"
                        }`}
                      >
                        {wipes}
                      </p>
                      <p
                        className={`mt-0.5 text-[9px] font-bold tracking-wide uppercase ${
                          wipes > 0 ? "text-muted" : "text-muted/50"
                        }`}
                      >
                        wipe{wipes === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selectedRow ? (
        <TrainerGravesModal
          slug={slug}
          row={selectedRow}
          filtering={filtering}
          canEditTrainer={editable.has(selectedRow.trainer.id)}
          onClose={() => setSelectedTrainerId(null)}
        />
      ) : null}
    </div>
  );
}

function TrainerGravesModal({
  slug,
  row,
  filtering,
  canEditTrainer,
  onClose,
}: {
  slug: string;
  row: TrainerGraveRow;
  filtering: boolean;
  canEditTrainer: boolean;
  onClose: () => void;
}) {
  const { trainer, graves, all } = row;
  const wipes = trainer.wipeCount ?? 0;
  const activeRunNumber = wipes + 1;
  const runGroups = groupByRun(graves);
  const subtitle = [
    filtering ? `${graves.length} of ${all.length} RIP` : `${graves.length} RIP`,
    wipes > 0 ? `${wipes} wipe${wipes === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Modal
      open
      title={displayName(trainer)}
      subtitle={subtitle}
      size="wide"
      onClose={onClose}
      headerActions={
        <Link
          href={`/challenges/${slug}/trainers/${trainer.id}`}
          className="pressable inline-flex min-h-11 items-center justify-center border-interactive/35 bg-interactive-soft px-2.5 py-1 text-xs font-semibold text-ink"
        >
          Board
        </Link>
      }
    >
      <div className="space-y-4">
        {runGroups.map(({ runNumber, graves: runGraves }) => (
          <div key={runNumber} className="space-y-1.5">
            {runGroups.length > 1 || runNumber > 1 ? (
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                Run {runNumber}
                {runNumber === activeRunNumber ? " · Current" : ""}
              </p>
            ) : null}
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {runGraves.map((grave) => (
                <MemorialGraveItem
                  key={grave.key}
                  trainerId={trainer.id}
                  grave={grave}
                  canEdit={
                    grave.source === "live" && canEditTrainer
                  }
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function MemorialGraveItem({
  trainerId,
  grave,
  canEdit,
}: {
  trainerId: string;
  grave: MemorialGrave;
  canEdit: boolean;
}) {
  const pokemon: PokemonEntry = grave.pokemon;
  const label = pokemon.nickname || pokemon.species;
  const fromHistory = grave.source === "snapshot";
  return (
    <li
      className="flex gap-3 rounded-md border border-frame/35 bg-surface/65 p-2.5"
      title={
        fromHistory
          ? "Recovered from board history — this run was cleared by a wipe"
          : undefined
      }
    >
      <div className="relative h-16 w-16 shrink-0">
        <PokemonSpriteImage
          alt=""
          className="pixelated h-full w-full object-contain opacity-90"
          height={64}
          pokedexId={pokemon.pokedexId}
          shiny={pokemon.isShiny}
          species={pokemon.species}
          width={64}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display truncate text-xs font-bold leading-tight">
          {label}
          {pokemon.isShiny ? (
            <span className="ml-0.5 text-accent-2" title="Shiny">
              ✦
            </span>
          ) : null}
        </p>
        <p className="truncate text-[11px] leading-tight text-muted">
          {pokemon.species}
          {pokemon.level != null ? ` · Lv.${pokemon.level}` : ""}
          {fromHistory ? " · from history" : ""}
        </p>
        <MemorialCauseEditor
          trainerId={trainerId}
          pokemonId={grave.pokemonId ?? ""}
          causeOfDeath={pokemon.causeOfDeath}
          canEdit={canEdit}
        />
      </div>
    </li>
  );
}

type MultiSelectOption<T extends string | number> = {
  value: T;
  label: string;
};

function MultiSelectFilter<T extends string | number>({
  label,
  emptyLabel,
  options,
  selected,
  onChange,
  formatSelected,
}: {
  label: string;
  emptyLabel: string;
  options: MultiSelectOption<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
  formatSelected?: (values: T[]) => string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedSet = new Set(selected);
  const summary =
    formatSelected?.(selected) ??
    (selected.length === 0
      ? emptyLabel
      : selected.length <= 2
        ? selected
            .map(
              (value) =>
                options.find((opt) => opt.value === value)?.label ?? String(value),
            )
            .join(", ")
        : `${selected.length} selected`);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle(value: T) {
    if (selectedSet.has(value)) {
      onChange(selected.filter((entry) => entry !== value));
      return;
    }
    onChange([...selected, value]);
  }

  return (
    <div ref={rootRef} className="relative min-w-36 flex-1 sm:flex-none">
      <p className="mb-1 text-[10px] font-bold tracking-wide text-muted uppercase">
        {label}
      </p>
      <button
        type="button"
        className="pressable flex h-9 w-full min-w-36 items-center justify-between gap-2 rounded-md border border-frame bg-surface px-2.5 text-left text-sm font-semibold text-ink sm:w-auto sm:max-w-56"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{summary}</span>
        <span aria-hidden className="text-[10px] text-muted">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          className="absolute top-full left-0 z-40 mt-1 max-h-56 w-[min(100vw-2rem,16rem)] overflow-y-auto overscroll-contain rounded-md border border-frame bg-surface shadow-md"
        >
          <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-frame/50 bg-surface px-2.5 py-1.5">
            <span className="text-[10px] font-bold tracking-wide text-muted uppercase">
              {selected.length === 0 ? "Any" : `${selected.length} selected`}
            </span>
            {selected.length > 0 ? (
              <button
                type="button"
                className="text-[11px] font-semibold text-interactive underline-offset-2 hover:underline"
                onClick={() => onChange([])}
              >
                Clear
              </button>
            ) : null}
          </div>
          <ul className="py-1">
            {options.map((option) => {
              const checked = selectedSet.has(option.value);
              return (
                <li key={String(option.value)}>
                  <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-interactive-soft/40">
                    <input
                      type="checkbox"
                      className="size-3.5 rounded border-frame"
                      checked={checked}
                      onChange={() => toggle(option.value)}
                    />
                    <span className="truncate font-medium">{option.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function GraveStatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M7 19v-8.5a5 5 0 0110 0V19" strokeLinejoin="round" />
      <path d="M5.5 19.5h13" strokeLinecap="round" />
      <path d="M12 9.75v4M10.25 11.25h3.5" strokeLinecap="round" />
    </svg>
  );
}

function TrainersStatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="9" cy="8" r="2.75" />
      <path
        d="M4.75 18.25c.4-2.4 2.15-3.75 4.25-3.75s3.85 1.35 4.25 3.75"
        strokeLinecap="round"
      />
      <circle cx="16.25" cy="9" r="2.25" />
      <path
        d="M14.5 18.25c.25-1.55 1.2-2.55 2.75-2.55 1.35 0 2.3.75 2.75 2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HistoryStatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M4.75 12a7.25 7.25 0 111.85 4.85"
        strokeLinecap="round"
      />
      <path
        d="M4.75 16.5v-3.75H8.5M12 8.25V12l2.5 1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
