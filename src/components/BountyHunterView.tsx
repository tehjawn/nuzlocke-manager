"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PokemonHoverPreview } from "@/components/PokemonHoverPreview";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import type { TrainerProfile } from "@/lib/challenge-types";
import {
  exclusiveOwnedSpecies,
  missingModernEmeraldSpecies,
  personalMissingModernEmerald,
  type ExclusiveSpecies,
} from "@/lib/encounter-stats";
import type { ModernEmeraldSpeciesRef } from "@/lib/modern-emerald-dex";
import {
  parseBountyMode,
  toolsHref,
  type BountyMode,
} from "@/lib/tools-routes";

type BountyHunterViewProps = {
  slug: string;
  trainers: TrainerProfile[];
  myTrainerId?: string | null;
  initialMode?: BountyMode | null;
};

const MODES: ReadonlyArray<{ id: BountyMode; label: string }> = [
  { id: "open", label: "Open bounties" },
  { id: "gaps", label: "My gaps" },
  { id: "exclusives", label: "Exclusives" },
];

export function BountyHunterView({
  slug,
  trainers,
  myTrainerId = null,
  initialMode = "open",
}: BountyHunterViewProps) {
  const [mode, setMode] = useState<BountyMode>(
    parseBountyMode(initialMode),
  );
  const [viewerId, setViewerId] = useState(
    () => myTrainerId ?? trainers[0]?.id ?? "",
  );
  const [query, setQuery] = useState("");

  const openBounties = useMemo(
    () => missingModernEmeraldSpecies(trainers),
    [trainers],
  );
  const gaps = useMemo(
    () =>
      viewerId
        ? personalMissingModernEmerald(trainers, viewerId)
        : openBounties,
    [trainers, viewerId, openBounties],
  );
  const exclusives = useMemo(
    () => exclusiveOwnedSpecies(trainers),
    [trainers],
  );

  function selectMode(next: BountyMode) {
    setMode(next);
    // Keep the shareable ?mode= URL without a tools-route RSC refetch.
    const url = new URL(window.location.href);
    url.searchParams.set("tool", "bounty");
    url.searchParams.set("mode", next);
    window.history.replaceState(window.history.state, "", url.href);
  }

  const q = query.trim().toLowerCase();
  const filteredOpen = filterSpecies(openBounties, q);
  const filteredGaps = filterSpecies(gaps, q);
  const filteredExclusives = exclusives.filter((entry) => {
    if (!q) return true;
    return (
      entry.species.toLowerCase().includes(q) ||
      entry.trainerHandle.toLowerCase().includes(q) ||
      String(entry.pokedexId).includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label="Bounty Hunter modes"
        className="flex flex-wrap gap-1.5"
      >
        {MODES.map((entry) => {
          const active = mode === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={active}
              onClick={() => selectMode(entry.id)}
              className={`pressable rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-interactive/40 bg-interactive-soft text-ink shadow-sm"
                  : "border-transparent bg-surface text-muted hover:bg-surface/80"
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[12rem] flex-1 space-y-1 text-xs font-semibold text-muted">
          Search
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Species, dex #…"
            className="w-full rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink"
          />
        </label>
        {mode === "gaps" ? (
          <label className="min-w-[10rem] space-y-1 text-xs font-semibold text-muted">
            Trainer
            <select
              value={viewerId}
              onChange={(event) => setViewerId(event.target.value)}
              className="w-full rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink"
            >
              {trainers.map((trainer) => (
                <option key={trainer.id} value={trainer.id}>
                  {trainer.handle}
                  {trainer.id === myTrainerId ? " (you)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {mode === "open" ? (
        <SpeciesGrid
          slug={slug}
          title={`Open bounties · ${filteredOpen.length} left in Modern Emerald`}
          empty="Nothing left — the pack has touched every ME species."
          entries={filteredOpen}
          mutedSprites
        />
      ) : null}

      {mode === "gaps" ? (
        <SpeciesGrid
          slug={slug}
          title={`My gaps · ${filteredGaps.length} still missing from this board`}
          empty="This board already has every Modern Emerald species logged. Show-off."
          entries={filteredGaps}
        />
      ) : null}

      {mode === "exclusives" ? (
        <ExclusivesList
          slug={slug}
          entries={filteredExclusives}
          total={exclusives.length}
        />
      ) : null}
    </div>
  );
}

function filterSpecies(
  entries: ModernEmeraldSpeciesRef[],
  q: string,
): ModernEmeraldSpeciesRef[] {
  if (!q) return entries;
  return entries.filter(
    (entry) =>
      entry.species.toLowerCase().includes(q) ||
      String(entry.pokedexId).includes(q),
  );
}

function SpeciesGrid({
  slug,
  title,
  empty,
  entries,
  mutedSprites = false,
}: {
  slug: string;
  title: string;
  empty: string;
  entries: ModernEmeraldSpeciesRef[];
  /** Soften sprites for never-seen open bounties (restored on hover). */
  mutedSprites?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{title}</p>
      {entries.length === 0 ? (
        <p className="rounded-md border border-frame/40 bg-surface/60 px-4 py-5 text-sm text-muted">
          {empty}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
          {entries.map((entry) => (
            <li key={entry.pokedexId}>
              <PokemonHoverPreview
                className="h-full"
                speciesPreview={{
                  species: entry.species,
                  pokedexId: entry.pokedexId,
                }}
              >
                <Link
                  href={toolsHref(slug, "pokedex", { id: entry.pokedexId })}
                  title={entry.species}
                  aria-label={`${entry.species} (#${String(entry.pokedexId).padStart(3, "0")})`}
                  className="pressable group flex h-full flex-col items-center gap-1 rounded-md border border-frame/30 bg-surface/50 px-1.5 py-2 hover:border-interactive/40 hover:bg-interactive-soft/40"
                >
                  <PokemonSpriteImage
                    alt=""
                    className={`pixelated h-12 w-12 object-contain transition-[filter,opacity] duration-150 sm:h-14 sm:w-14 ${
                      mutedSprites
                        ? "opacity-55 grayscale-[35%] group-hover:opacity-100 group-hover:grayscale-0"
                        : ""
                    }`}
                    height={56}
                    pokedexId={entry.pokedexId}
                    species={entry.species}
                    width={56}
                  />
                  <span className="max-w-full truncate text-[10px] font-semibold text-ink">
                    {entry.species}
                  </span>
                  <span className="text-[9px] font-semibold tabular-nums text-muted">
                    #{String(entry.pokedexId).padStart(3, "0")}
                  </span>
                </Link>
              </PokemonHoverPreview>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExclusivesList({
  slug,
  entries,
  total,
}: {
  slug: string;
  entries: ExclusiveSpecies[];
  total: number;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Exclusives · {entries.length}
        {entries.length !== total ? ` of ${total}` : ""} pack monopolies
      </p>
      {entries.length === 0 ? (
        <p className="rounded-md border border-frame/40 bg-surface/60 px-4 py-5 text-sm text-muted">
          No exclusives right now — every living species is shared or untouched.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
          {entries.map((entry) => (
            <li key={`${entry.pokedexId}-${entry.trainerId}`}>
              <PokemonHoverPreview
                className="h-full"
                speciesPreview={{
                  species: entry.species,
                  pokedexId: entry.pokedexId,
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
                    #{String(entry.pokedexId).padStart(3, "0")} ·{" "}
                    {entry.trainerHandle}
                  </span>
                </Link>
              </PokemonHoverPreview>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
