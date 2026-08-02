"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
  const router = useRouter();
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
    router.replace(toolsHref(slug, "bounty", { mode: next }), {
      scroll: false,
    });
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
        role="tablist"
        aria-label="Bounty Hunter modes"
        className="flex flex-wrap gap-1.5"
      >
        {MODES.map((entry) => {
          const active = mode === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
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
}: {
  slug: string;
  title: string;
  empty: string;
  entries: ModernEmeraldSpeciesRef[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{title}</p>
      {entries.length === 0 ? (
        <p className="rounded-md border border-frame/40 bg-surface/60 px-4 py-5 text-sm text-muted">
          {empty}
        </p>
      ) : (
        <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
          {entries.map((entry) => (
            <li key={entry.pokedexId}>
              <Link
                href={toolsHref(slug, "pokedex", { id: entry.pokedexId })}
                title={entry.species}
                className="pressable flex flex-col items-center gap-0.5 rounded-md border border-frame/30 bg-surface/50 px-1 py-1.5 hover:border-interactive/40 hover:bg-interactive-soft/40"
              >
                <PokemonSpriteImage
                  alt=""
                  className="pixelated h-8 w-8 object-contain"
                  height={32}
                  pokedexId={entry.pokedexId}
                  species={entry.species}
                  width={32}
                />
                <span className="max-w-full truncate text-[9px] font-semibold text-ink">
                  {entry.species}
                </span>
                <span className="text-[9px] font-semibold tabular-nums text-muted">
                  #{String(entry.pokedexId).padStart(3, "0")}
                </span>
              </Link>
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
        (Main / Reserve only)
      </p>
      {entries.length === 0 ? (
        <p className="rounded-md border border-frame/40 bg-surface/60 px-4 py-5 text-sm text-muted">
          No exclusives right now — every living species is shared or untouched.
        </p>
      ) : (
        <ul className="divide-y divide-frame/40 rounded-md border border-frame/40 bg-surface/50">
          {entries.map((entry) => (
            <li
              key={`${entry.pokedexId}-${entry.trainerId}`}
              className="flex items-center gap-2.5 px-3 py-1.5"
            >
              <Link
                href={toolsHref(slug, "pokedex", { id: entry.pokedexId })}
                className="flex min-w-0 flex-1 items-center gap-2.5 hover:text-ink"
              >
                <PokemonSpriteImage
                  alt=""
                  className="pixelated h-8 w-8 shrink-0 object-contain"
                  height={32}
                  pokedexId={entry.pokedexId}
                  species={entry.species}
                  width={32}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {entry.species}
                  </span>
                  <span className="text-[11px] text-muted">
                    #{String(entry.pokedexId).padStart(3, "0")} · only @
                    {entry.trainerHandle} ({entry.slot === "MAIN" ? "Main" : "Reserve"})
                  </span>
                </span>
              </Link>
              <Link
                href={`/challenges/${slug}/trainers/${entry.trainerId}`}
                className="shrink-0 text-[11px] font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
              >
                Board
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
