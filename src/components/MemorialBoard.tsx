"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import { AvatarPortrait } from "@/components/AvatarPortrait";
import { Frame } from "@/components/Frame";
import { MemorialCauseEditor } from "@/components/MemorialCauseEditor";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { typeBadgeSoftStyle } from "@/components/TypeBadge";
import { POKEMON_GENERATIONS } from "@/data/pokemon-index";
import type { Challenge, PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import type {
  CrossRunGravesResult,
  MemorialGrave,
} from "@/lib/memorial-backfill";
import {
  memorialPokemonMatchesFilters,
  memorialSeasonHighlights,
} from "@/lib/memorial-stats";
import {
  POKEMON_TYPES,
  TYPE_COLORS,
  type PokemonType,
} from "@/lib/pokemon-types";
import { displayName } from "@/lib/trainer-display";

type MemorialBoardProps = {
  challenge: Challenge;
  /** Trainer IDs the viewer may edit causes for (owner / GM with lens). */
  editableTrainerIds?: string[];
  /** Cross-run graves per trainer: live rows + graves recovered from history. */
  gravesByTrainerId: Record<string, CrossRunGravesResult>;
};

function formatTiedLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
}

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

export function MemorialBoard({
  challenge,
  editableTrainerIds = [],
  gravesByTrainerId,
}: MemorialBoardProps) {
  const editable = new Set(editableTrainerIds);
  const [typeFilter, setTypeFilter] = useState<PokemonType | null>(null);
  const [generationFilter, setGenerationFilter] = useState<number | null>(null);

  const filters = { type: typeFilter, generation: generationFilter };
  const filtering = typeFilter != null || generationFilter != null;

  const allByTrainer = challenge.trainers.map((trainer) => ({
    trainer,
    all: gravesByTrainerId[trainer.id]?.graves ?? [],
    recovered: gravesByTrainerId[trainer.id]?.recoveredCount ?? 0,
  }));

  const byTrainer = allByTrainer
    .map((row) => ({
      ...row,
      graves: row.all.filter((grave) =>
        memorialPokemonMatchesFilters(grave.pokemon, filters),
      ),
    }))
    .filter((row) => row.graves.length > 0);

  const filteredGraveCount = byTrainer.reduce(
    (sum, row) => sum + row.graves.length,
    0,
  );
  const recoveredCount = allByTrainer.reduce(
    (sum, row) => sum + row.recovered,
    0,
  );

  const highlights = memorialSeasonHighlights(
    challenge.trainers,
    Object.fromEntries(
      allByTrainer.map((row) => [
        row.trainer.id,
        row.all.map((grave) => grave.pokemon),
      ]),
    ),
  );
  const trainersById = new Map(
    challenge.trainers.map((trainer) => [trainer.id, trainer]),
  );

  function trainersForHighlight(
    highlight: { trainerIds: string[] } | null | undefined,
  ): TrainerProfile[] {
    if (!highlight) return [];
    return highlight.trainerIds
      .map((id) => trainersById.get(id))
      .filter((trainer): trainer is TrainerProfile => Boolean(trainer));
  }

  const heaviestTrainers = trainersForHighlight(highlights.heaviestMemorial);
  const wipeTrainers = trainersForHighlight(highlights.mostPartyWipes);
  const richestTrainers = trainersForHighlight(highlights.richest);
  const hasCallouts = Boolean(
    highlights.heaviestMemorial ||
      highlights.mostPartyWipes ||
      highlights.mostDeathProne ||
      highlights.richest,
  );

  const hasAnyGraves = highlights.totalGraves > 0;

  return (
    <div className="space-y-5">
      <header className="space-y-1.5">
        <p className="text-xs font-semibold tracking-tight text-accent-deep">
          Across every wipe
        </p>
        <h2 className="text-2xl font-bold tracking-tight">Memorial</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Every fallen partner from {challenge.name}
          {challenge.status === "ARCHIVED"
            ? " — season archived and read-only"
            : ""}
          , including losses carried through run restarts. Nicknames first;
          causes when known.
        </p>
        <p className="text-xs text-muted">
          {filtering
            ? `${filteredGraveCount} shown · ${highlights.totalGraves} memorialized`
            : `${highlights.totalGraves} memorialized`}{" "}
          · {highlights.trainersWithLosses} trainers with losses
          {recoveredCount > 0
            ? ` · ${recoveredCount} recovered from board history`
            : ""}
        </p>
      </header>

      {hasAnyGraves ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
              Type
            </p>
            <div
              role="group"
              aria-label="Filter by type"
              className="flex flex-wrap items-center gap-1.5"
            >
              <FilterChip
                active={typeFilter == null}
                onClick={() => setTypeFilter(null)}
              >
                All
              </FilterChip>
              {POKEMON_TYPES.map((type) => (
                <FilterChip
                  key={type}
                  active={typeFilter === type}
                  onClick={() =>
                    setTypeFilter((current) => (current === type ? null : type))
                  }
                  style={
                    typeFilter === type
                      ? undefined
                      : typeBadgeSoftStyle(TYPE_COLORS[type])
                  }
                >
                  {type}
                </FilterChip>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
              Generation
            </p>
            <div
              role="group"
              aria-label="Filter by generation"
              className="flex flex-wrap items-center gap-1.5"
            >
              <FilterChip
                active={generationFilter == null}
                onClick={() => setGenerationFilter(null)}
              >
                All
              </FilterChip>
              {POKEMON_GENERATIONS.map((g) => (
                <FilterChip
                  key={g}
                  active={generationFilter === g}
                  onClick={() =>
                    setGenerationFilter((current) => (current === g ? null : g))
                  }
                >
                  {g}
                </FilterChip>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {hasCallouts ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.heaviestMemorial ? (
            <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                Heaviest memorial
                {highlights.heaviestMemorial.tied ? " · tied" : ""}
              </p>
              <div className="mt-1 flex items-center gap-2.5">
                {heaviestTrainers.length > 0 ? (
                  <div className="flex shrink-0 items-end -space-x-2">
                    {heaviestTrainers.slice(0, 3).map((trainer) => (
                      <AvatarPortrait
                        key={trainer.id}
                        avatarSpriteKey={trainer.avatarSpriteKey}
                        backgroundKey={trainer.avatarBackgroundKey}
                        sizeClass="h-12 w-12"
                        width={48}
                        height={48}
                        alt=""
                      />
                    ))}
                  </div>
                ) : null}
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold leading-tight">
                    {formatTiedLabels(highlights.heaviestMemorial.labels)}
                  </p>
                  <p className="text-[11px] text-muted">
                    {highlights.heaviestMemorial.count} RIP
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {highlights.mostPartyWipes ? (
            <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                Most party wipes
                {highlights.mostPartyWipes.tied ? " · tied" : ""}
              </p>
              <div className="mt-1 flex items-center gap-2.5">
                {wipeTrainers.length > 0 ? (
                  <div className="flex shrink-0 items-end -space-x-2">
                    {wipeTrainers.slice(0, 3).map((trainer) => (
                      <AvatarPortrait
                        key={trainer.id}
                        avatarSpriteKey={trainer.avatarSpriteKey}
                        backgroundKey={trainer.avatarBackgroundKey}
                        sizeClass="h-12 w-12"
                        width={48}
                        height={48}
                        alt=""
                      />
                    ))}
                  </div>
                ) : null}
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold leading-tight">
                    {formatTiedLabels(highlights.mostPartyWipes.labels)}
                  </p>
                  <p className="text-[11px] text-muted">
                    {highlights.mostPartyWipes.count} wipe
                    {highlights.mostPartyWipes.count === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {highlights.mostDeathProne ? (
            <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                Most death-prone Pokémon
                {highlights.mostDeathProne.tied ? " · tied" : ""}
              </p>
              <p className="mt-1 flex items-center gap-2.5 font-display text-sm font-bold leading-tight">
                <span className="relative inline-block h-12 w-12 shrink-0">
                  <PokemonSpriteImage
                    alt=""
                    className="pixelated h-full w-full object-contain"
                    height={48}
                    pokedexId={highlights.mostDeathProne.pokedexId}
                    species={highlights.mostDeathProne.species}
                    width={48}
                  />
                </span>
                <span className="min-w-0">
                  {highlights.mostDeathProne.species}
                  <span className="mt-0.5 block font-sans text-[11px] font-normal text-muted">
                    {highlights.mostDeathProne.count} RIP across the season
                  </span>
                </span>
              </p>
            </div>
          ) : null}

          {highlights.richest ? (
            <div className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                Richest
                {highlights.richest.tied ? " · tied" : ""}
              </p>
              <div className="mt-1 flex items-center gap-2.5">
                {richestTrainers.length > 0 ? (
                  <div className="flex shrink-0 items-end -space-x-2">
                    {richestTrainers.slice(0, 3).map((trainer) => (
                      <AvatarPortrait
                        key={trainer.id}
                        avatarSpriteKey={trainer.avatarSpriteKey}
                        backgroundKey={trainer.avatarBackgroundKey}
                        sizeClass="h-12 w-12"
                        width={48}
                        height={48}
                        alt=""
                      />
                    ))}
                  </div>
                ) : null}
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold leading-tight">
                    {formatTiedLabels(highlights.richest.labels)}
                  </p>
                  <p className="text-[11px] text-muted">
                    ${highlights.richest.count.toLocaleString("en-US")}
                  </p>
                </div>
              </div>
            </div>
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
              onClick={() => {
                setTypeFilter(null);
                setGenerationFilter(null);
              }}
            >
              Clear filters
            </button>
          </p>
        </Frame>
      ) : (
        <div className="space-y-4">
          {byTrainer.map(({ trainer, graves, all }) => {
            const wipes = trainer.wipeCount ?? 0;
            const activeRunNumber = wipes + 1;
            const runGroups = groupByRun(graves);
            return (
              <Frame
                key={trainer.id}
                title={displayName(trainer)}
                tone="rip"
                dense
                actions={
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold tabular-nums text-white/80">
                      {filtering
                        ? `${graves.length} of ${all.length} RIP`
                        : `${graves.length} RIP`}
                      {wipes > 0
                        ? ` · ${wipes} wipe${wipes === 1 ? "" : "s"}`
                        : ""}
                    </span>
                    <Link
                      href={`/challenges/${challenge.slug}/trainers/${trainer.id}`}
                      className="text-xs font-bold text-white/90 underline-offset-2 hover:underline"
                    >
                      Board
                    </Link>
                  </div>
                }
              >
                <div className="space-y-3">
                  {runGroups.map(({ runNumber, graves: runGraves }) => (
                    <div key={runNumber} className="space-y-1.5">
                      {runGroups.length > 1 || runNumber > 1 ? (
                        <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                          Run {runNumber}
                          {runNumber === activeRunNumber ? " · Current" : ""}
                        </p>
                      ) : null}
                      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {runGraves.map((grave) => (
                          <MemorialGraveItem
                            key={grave.key}
                            trainerId={trainer.id}
                            grave={grave}
                            canEdit={
                              grave.source === "live" && editable.has(trainer.id)
                            }
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Frame>
            );
          })}
        </div>
      )}
    </div>
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

function FilterChip({
  active,
  onClick,
  children,
  style,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={style}
      className={`pressable inline-flex h-8 items-center rounded-lg px-2 text-xs font-semibold tracking-tight ${
        active
          ? "bg-accent text-[var(--on-accent)]"
          : "border border-frame bg-surface"
      }`}
    >
      {children}
    </button>
  );
}
