"use client";

import { useMemo, useState } from "react";
import { PokemonDetailsModal } from "@/components/PokemonDetailsModal";
import { PokemonSpriteImage } from "@/components/PokemonSpriteImage";
import { TombstoneIcon } from "@/components/TombstoneIcon";
import { TypeBadge } from "@/components/TypeBadge";
import { POKEMON_GENERATIONS } from "@/data/pokemon-index";
import type { PokemonSlot } from "@/lib/challenge-types";
import {
  catchTierHasChrome,
  catchTierLabel,
  catchTierToneClass,
  CATCH_TIERS,
  type CatchTier,
} from "@/lib/iv-quality";
import { POKEMON_TYPES, type PokemonType } from "@/lib/pokemon-types";
import { STAT_RANKS, statRankToneClass, type StatRank } from "@/lib/species-ranks";
import {
  sortSpecimenRows,
  specimenMatchesFilters,
  specimenMatchesSlotScope,
  type SpecimenFilters,
  type SpecimenRow,
  type SpecimenSlotScope,
  type SpecimenSort,
} from "@/lib/specimen-board";

type SpecimenShowcaseProps = {
  /** Enables the "just mine" nudge when catch tier is the sort. */
  myTrainerId: string | null;
  onScopeToMyTrainer: () => void;
  /** Already lowercased + trimmed by the caller. */
  query: string;
  rows: SpecimenRow[];
  slug: string;
  /** Owned by the shared Ownership chrome above the panel. */
  sort: SpecimenSort;
  trainerId: string | null;
};

const SLOT_SCOPES: ReadonlyArray<{ id: SpecimenSlotScope; label: string }> = [
  { id: "living", label: "Living" },
  { id: "MAIN", label: "Main" },
  { id: "RESERVE", label: "Reserve" },
  { id: "ENCOUNTERED", label: "Encountered" },
  { id: "GRAVEYARD", label: "Memorialized" },
  { id: "all", label: "All" },
];

/** God first — a "best catch" filter shouldn't open on the worst tier. */
const CATCH_TIER_OPTIONS = [...CATCH_TIERS].reverse();
const BST_RANK_OPTIONS = [...STAT_RANKS].reverse();

const FILTER_SELECT_CLASS =
  "w-full rounded-md border border-frame bg-surface px-2.5 py-2 text-sm font-normal text-ink";

export function SpecimenShowcase({
  myTrainerId,
  onScopeToMyTrainer,
  query,
  rows,
  slug,
  sort,
  trainerId,
}: SpecimenShowcaseProps) {
  const [slot, setSlot] = useState<SpecimenSlotScope>("living");
  const [type, setType] = useState<PokemonType | null>(null);
  const [generation, setGeneration] = useState<number | null>(null);
  const [shinyOnly, setShinyOnly] = useState(false);
  const [catchTier, setCatchTier] = useState<CatchTier | null>(null);
  const [bstRank, setBstRank] = useState<StatRank | null>(null);
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  // Everything except slot, so the chip tallies below describe what switching
  // scope would actually reveal rather than the whole unfiltered season.
  const slotScopedRows = useMemo(() => {
    const base: SpecimenFilters = {
      bstRank,
      catchTier,
      generation,
      query,
      shinyOnly,
      slot: "all",
      trainerId,
      type,
    };
    return rows.filter((row) => specimenMatchesFilters(row, base));
  }, [rows, trainerId, type, generation, shinyOnly, catchTier, bstRank, query]);

  const slotCounts = useMemo(() => {
    const counts = new Map<SpecimenSlotScope, number>();
    for (const scope of SLOT_SCOPES) {
      counts.set(
        scope.id,
        slotScopedRows.filter((row) =>
          specimenMatchesSlotScope(row.slot, scope.id),
        ).length,
      );
    }
    return counts;
  }, [slotScopedRows]);

  const visible = useMemo(
    () =>
      sortSpecimenRows(
        slotScopedRows.filter((row) =>
          specimenMatchesSlotScope(row.slot, slot),
        ),
        sort,
      ),
    [slotScopedRows, slot, sort],
  );

  const gradedCount = rows.filter((row) => !row.catchTierHidden).length;
  const hiddenCount = rows.length - gradedCount;

  // Looked up in the whole season, not `visible`: the living-only default is
  // itself a filter, so a grave opened from the "Memorialized" chip must not
  // vanish mid-read if the scope changes underneath it.
  const openRow = rows.find((row) => row.id === openRowId) ?? null;
  const showScopeNudge =
    (sort === "catch" || catchTier !== null) &&
    myTrainerId !== null &&
    trainerId !== myTrainerId &&
    gradedCount > 0;

  return (
    <div className="space-y-4">
      <div aria-label="Slot filter" className="flex flex-wrap gap-1.5" role="group">
        {SLOT_SCOPES.map((scope) => {
          const active = slot === scope.id;
          return (
            <button
              aria-pressed={active}
              className={`pressable rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                active
                  ? "border-interactive/40 bg-interactive-soft text-ink shadow-sm"
                  : "border-frame/50 bg-surface text-muted hover:bg-surface/80"
              }`}
              data-testid={`showcase-slot-${scope.id.toLowerCase()}`}
              key={scope.id}
              onClick={() => setSlot(scope.id)}
              type="button"
            >
              {scope.label} · {slotCounts.get(scope.id) ?? 0}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[8rem] space-y-1 text-xs font-semibold text-muted">
          Type
          <select
            className={FILTER_SELECT_CLASS}
            data-testid="showcase-filter-type"
            onChange={(event) =>
              setType(
                POKEMON_TYPES.find((entry) => entry === event.target.value) ??
                  null,
              )
            }
            value={type ?? ""}
          >
            <option value="">Any type</option>
            {POKEMON_TYPES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[8rem] space-y-1 text-xs font-semibold text-muted">
          Generation
          <select
            className={FILTER_SELECT_CLASS}
            data-testid="showcase-filter-generation"
            onChange={(event) =>
              setGeneration(
                event.target.value ? Number(event.target.value) : null,
              )
            }
            value={generation ?? ""}
          >
            <option value="">Any gen</option>
            {POKEMON_GENERATIONS.map((entry) => (
              <option key={entry} value={entry}>
                Gen {entry}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[9rem] space-y-1 text-xs font-semibold text-muted">
          Catch tier
          <select
            className={FILTER_SELECT_CLASS}
            data-testid="showcase-filter-catch-tier"
            onChange={(event) =>
              setCatchTier(
                CATCH_TIERS.find((entry) => entry === event.target.value) ??
                  null,
              )
            }
            value={catchTier ?? ""}
          >
            <option value="">Any catch tier</option>
            {CATCH_TIER_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>
                {catchTierLabel(entry)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[8rem] space-y-1 text-xs font-semibold text-muted">
          BST tier
          <select
            className={FILTER_SELECT_CLASS}
            data-testid="showcase-filter-bst-tier"
            onChange={(event) =>
              setBstRank(
                STAT_RANKS.find((entry) => entry === event.target.value) ?? null,
              )
            }
            value={bstRank ?? ""}
          >
            <option value="">Any BST tier</option>
            {BST_RANK_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
        <button
          aria-pressed={shinyOnly}
          className={`pressable rounded-md border px-2.5 py-2 text-xs font-semibold transition-colors ${
            shinyOnly
              ? "border-accent-2/45 bg-accent-2/15 text-ink shadow-sm"
              : "border-frame/50 bg-surface text-muted hover:bg-surface/80"
          }`}
          data-testid="showcase-filter-shiny"
          onClick={() => setShinyOnly((current) => !current)}
          type="button"
        >
          Shiny only ✦
        </button>
      </div>

      {hiddenCount > 0 && (
        <p className="rounded-md border border-frame/40 bg-surface/60 px-3 py-2 text-[11px] leading-snug text-muted">
          Catch tier is IV-derived, and IVs stay private to their owner —{" "}
          {gradedCount > 0
            ? `${gradedCount} of ${rows.length} Pokémon are graded here.`
            : "no Pokémon on this page are graded for you."}{" "}
          Species, level, BST tier, and type are shown for everyone.
          {showScopeNudge && (
            <>
              {" "}
              <button
                className="font-semibold text-interactive underline decoration-interactive/35 underline-offset-2 hover:decoration-interactive"
                data-testid="showcase-scope-to-me"
                onClick={onScopeToMyTrainer}
                type="button"
              >
                Show only my Pokémon
              </button>
            </>
          )}
        </p>
      )}

      <p className="text-xs text-muted">
        {visible.length}
        {visible.length !== rows.length && ` of ${rows.length}`} Pokémon
      </p>

      {visible.length === 0 ? (
        <p className="rounded-md border border-frame/40 bg-surface/60 px-4 py-5 text-sm text-muted">
          {rows.length === 0
            ? "No Pokémon logged in this season yet."
            : "Nothing matches these filters."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visible.map((row) => (
            <li key={row.id}>
              <SpecimenCard onSelect={() => setOpenRowId(row.id)} row={row} />
            </li>
          ))}
        </ul>
      )}

      <PokemonDetailsModal
        onClose={() => setOpenRowId(null)}
        open={openRow !== null}
        pokemon={openRow?.pokemon ?? null}
        showCompetitiveDetails={openRow !== null && !openRow.catchTierHidden}
        slug={slug}
      />
    </div>
  );
}

const SLOT_BADGES: Record<PokemonSlot, string | null> = {
  ENCOUNTERED: "Seen",
  GRAVEYARD: "R.I.P.",
  MAIN: null,
  RESERVE: "Reserve",
};

/**
 * Dense browse tile. Deliberately not a third full specimen card — it borrows
 * `PokemonSlotCard`'s ring/sprite chrome verbatim and hands everything else to
 * `PokemonDetailsModal` on click.
 */
function SpecimenCard({
  onSelect,
  row,
}: {
  onSelect: () => void;
  row: SpecimenRow;
}) {
  const tier = row.catchTier;
  const hasChrome = tier !== null && catchTierHasChrome(tier);
  const label = row.nickname?.trim() || row.species;
  const showSpecies = Boolean(row.nickname?.trim());
  const slotBadge = SLOT_BADGES[row.slot];
  const meta =
    [showSpecies ? row.species : null, row.level !== null ? `Lv ${row.level}` : null]
      .filter(Boolean)
      .join(" · ") || "—";

  return (
    <button
      aria-label={`${label}${row.level !== null ? `, level ${row.level}` : ""}, ${row.trainerHandle}`}
      className="h-full w-full cursor-pointer text-left"
      data-testid="showcase-specimen-card"
      onClick={onSelect}
      type="button"
    >
      <div
        className={`pokemon-catch-ring pokemon-catch-ring--${hasChrome ? tier : "oof"} h-full`}
      >
        <div
          className={`flex h-full flex-col gap-1.5 rounded-lg border bg-surface p-2 ${
            hasChrome ? "border-transparent" : "border-frame"
          } ${row.slot === "GRAVEYARD" ? "opacity-90" : ""}`}
        >
          <div className="flex items-start gap-2">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border bg-surface-2 ${
                hasChrome
                  ? `pokemon-catch-sprite pokemon-catch-sprite--${tier}`
                  : "border-frame"
              }`}
            >
              <PokemonSpriteImage
                alt=""
                className="pixelated h-12 w-12 object-contain"
                height={56}
                pokedexId={row.pokedexId}
                shiny={row.isShiny}
                species={row.species}
                width={56}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold leading-tight tracking-tight">
                {label}
                {row.isShiny && (
                  <span className="ml-0.5 text-accent-2" title="Shiny">
                    ✦
                  </span>
                )}
              </p>
              <p className="truncate text-[10px] leading-tight text-muted">
                {meta}
              </p>
              <p className="truncate font-mono text-[10px] leading-tight tabular-nums text-muted">
                #
                {row.pokedexId !== null
                  ? String(row.pokedexId).padStart(3, "0")
                  : "—"}
              </p>
            </div>
          </div>

          {row.types.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {row.types.map((entry) => (
                <TypeBadge key={entry} size="sm" type={entry} />
              ))}
            </div>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-1 pt-0.5">
            <span className="min-w-0 max-w-full truncate rounded border border-frame/40 bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
              {row.trainerHandle}
            </span>
            {row.bstRank !== null && (
              <span
                className={`inline-flex items-center rounded border px-1 text-[10px] font-bold leading-tight ${statRankToneClass(row.bstRank)}`}
                title={`BST ${row.bst} — tier ${row.bstRank} among Modern Emerald species`}
              >
                {row.bstRank}
              </span>
            )}
            {slotBadge !== null && (
              <span className="inline-flex items-center gap-0.5 rounded border border-frame/40 bg-surface-2 px-1 py-0.5 text-[10px] font-semibold text-muted">
                {row.slot === "GRAVEYARD" && (
                  <TombstoneIcon className="h-2.5 w-2.5 shrink-0" />
                )}
                {slotBadge}
              </span>
            )}
          </div>

          {tier !== null && (
            <p
              className={`truncate text-[10px] font-semibold leading-tight tracking-tight ${catchTierToneClass(tier)}`}
            >
              {catchTierLabel(tier)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
