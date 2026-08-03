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
import {
  memorialPokemonMatchesFilters,
  memorialSeasonHighlights,
} from "@/lib/memorial-stats";
import {
  POKEMON_TYPES,
  TYPE_COLORS,
  type PokemonType,
} from "@/lib/pokemon-types";
import { displayName, pokemonInSlot } from "@/lib/trainer-display";

type MemorialBoardProps = {
  challenge: Challenge;
  /** Trainer IDs the viewer may edit causes for (owner / GM with lens). */
  editableTrainerIds?: string[];
};

function formatTiedLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
}

export function MemorialBoard({
  challenge,
  editableTrainerIds = [],
}: MemorialBoardProps) {
  const editable = new Set(editableTrainerIds);
  const [typeFilter, setTypeFilter] = useState<PokemonType | null>(null);
  const [generationFilter, setGenerationFilter] = useState<number | null>(null);

  const filters = { type: typeFilter, generation: generationFilter };
  const filtering = typeFilter != null || generationFilter != null;

  const byTrainer = challenge.trainers
    .map((trainer) => ({
      trainer,
      graves: pokemonInSlot(trainer, "GRAVEYARD").filter((pokemon) =>
        memorialPokemonMatchesFilters(pokemon, filters),
      ),
    }))
    .filter((row) => row.graves.length > 0);

  const filteredGraveCount = byTrainer.reduce(
    (sum, row) => sum + row.graves.length,
    0,
  );

  const highlights = memorialSeasonHighlights(challenge.trainers);
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
          {byTrainer.map(({ trainer, graves }) => {
            const wipes = trainer.wipeCount ?? 0;
            return (
              <Frame
                key={trainer.id}
                title={displayName(trainer)}
                tone="rip"
                dense
                actions={
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold tabular-nums text-white/80">
                      {graves.length} RIP
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
                <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {graves.map((pokemon) => (
                    <MemorialGraveItem
                      key={pokemon.id}
                      trainerId={trainer.id}
                      pokemon={pokemon}
                      canEdit={editable.has(trainer.id)}
                    />
                  ))}
                </ul>
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
  pokemon,
  canEdit,
}: {
  trainerId: string;
  pokemon: PokemonEntry;
  canEdit: boolean;
}) {
  const label = pokemon.nickname || pokemon.species;
  return (
    <li className="flex gap-3 rounded-md border border-frame/35 bg-surface/65 p-2.5">
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
          {pokemon.diedOnRun != null ? ` · Run ${pokemon.diedOnRun}` : ""}
        </p>
        <MemorialCauseEditor
          trainerId={trainerId}
          pokemonId={pokemon.id}
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
