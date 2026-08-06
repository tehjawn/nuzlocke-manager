"use client";

import { useMemo, useState } from "react";
import { BondHeart } from "@/components/BondHeart";
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
import {
  STAT_RANKS_BEST_FIRST,
  statRankToneClass,
  type StatRank,
} from "@/lib/species-ranks";
import {
  sortSpecimenRows,
  specimenMatchesFilters,
  specimenMatchesSlotScope,
  type SpecimenFilters,
  type SpecimenRow,
  type SpecimenSlotScope,
  type SpecimenSort,
} from "@/lib/specimen-board";
import {
  trainingTierHasHeart,
} from "@/lib/training-quality";

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
const BST_RANK_OPTIONS = STAT_RANKS_BEST_FIRST;

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
  const [competitiveRank, setCompetitiveRank] = useState<StatRank | null>(
    null,
  );
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  // Everything except slot, so the chip tallies below describe what switching
  // scope would actually reveal rather than the whole unfiltered season.
  const slotScopedRows = useMemo(() => {
    const base: SpecimenFilters = {
      bstRank,
      catchTier,
      competitiveRank,
      generation,
      query,
      shinyOnly,
      slot: "all",
      trainerId,
      type,
    };
    return rows.filter((row) => specimenMatchesFilters(row, base));
  }, [
    rows,
    trainerId,
    type,
    generation,
    shinyOnly,
    catchTier,
    bstRank,
    competitiveRank,
    query,
  ]);

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
    (sort === "catch" ||
      sort === "training" ||
      catchTier !== null) &&
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
          BST score
          <select
            className={FILTER_SELECT_CLASS}
            data-testid="showcase-filter-bst-tier"
            onChange={(event) =>
              setBstRank(
                (STAT_RANKS_BEST_FIRST as readonly string[]).includes(
                  event.target.value,
                )
                  ? (event.target.value as StatRank)
                  : null,
              )
            }
            value={bstRank ?? ""}
          >
            <option value="">Any BST score</option>
            {BST_RANK_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[8rem] space-y-1 text-xs font-semibold text-muted">
          Comp score
          <select
            className={FILTER_SELECT_CLASS}
            data-testid="showcase-filter-comp-tier"
            onChange={(event) =>
              setCompetitiveRank(
                (STAT_RANKS_BEST_FIRST as readonly string[]).includes(
                  event.target.value,
                )
                  ? (event.target.value as StatRank)
                  : null,
              )
            }
            value={competitiveRank ?? ""}
          >
            <option value="">Any Comp score</option>
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
          Species, level, BST score, competitive score, and type are shown for
          everyone.
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
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
 * Sprite-first browse tile. Catch-ring chrome stays; the letter grades are
 * labeled BST / Comp so they never read as anonymous report-card marks next
 * to the trainer handle.
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
    [
      showSpecies ? row.species : null,
      row.level !== null ? `Lv ${row.level}` : null,
    ]
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
          className={`flex h-full flex-col gap-2 rounded-lg border bg-surface p-2.5 ${
            hasChrome ? "border-transparent" : "border-frame"
          } ${row.slot === "GRAVEYARD" ? "opacity-90" : ""}`}
        >
          <div
            className={`relative mx-auto flex aspect-square w-full max-w-[5.5rem] items-center justify-center rounded-lg border bg-surface-2 sm:max-w-[6.5rem] ${
              hasChrome
                ? `pokemon-catch-sprite pokemon-catch-sprite--${tier}`
                : "border-frame"
            }`}
          >
            <PokemonSpriteImage
              alt=""
              className="pixelated h-[88%] w-[88%] object-contain"
              height={96}
              pokedexId={row.pokedexId}
              shiny={row.isShiny}
              species={row.species}
              width={96}
            />
            {row.trainingTier &&
            trainingTierHasHeart(row.trainingTier) &&
            !row.trainingTierHidden ? (
              <BondHeart
                className="pokemon-bond-heart--corner h-3.5 w-3.5"
                tier={row.trainingTier}
              />
            ) : null}
          </div>

          <div className="min-w-0 space-y-0.5 text-center">
            <p className="truncate text-sm font-bold leading-tight tracking-tight">
              {label}
              {row.isShiny && (
                <span className="ml-0.5 text-accent-2" title="Shiny">
                  ✦
                </span>
              )}
            </p>
            <p className="truncate text-[11px] leading-tight text-muted">
              {meta}
            </p>
            <p className="truncate font-mono text-[10px] leading-tight tabular-nums text-muted">
              #
              {row.pokedexId !== null
                ? String(row.pokedexId).padStart(3, "0")
                : "—"}
            </p>
          </div>

          {row.types.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {row.types.map((entry) => (
                <TypeBadge key={entry} size="sm" type={entry} />
              ))}
            </div>
          )}

          {tier !== null && (
            <p
              className={`truncate text-center text-[11px] font-bold leading-tight tracking-tight ${catchTierToneClass(tier)}`}
            >
              {catchTierLabel(tier)}
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-center justify-center gap-1 pt-0.5">
            <span className="min-w-0 max-w-full truncate rounded border border-frame/40 bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
              {row.trainerHandle}
            </span>
            {slotBadge !== null && (
              <span className="inline-flex items-center gap-0.5 rounded border border-frame/40 bg-surface-2 px-1 py-0.5 text-[10px] font-semibold text-muted">
                {row.slot === "GRAVEYARD" && (
                  <TombstoneIcon className="h-2.5 w-2.5 shrink-0" />
                )}
                {slotBadge}
              </span>
            )}
          </div>

          {(row.bstRank !== null || row.competitiveRank !== null) && (
            <div className="flex flex-wrap items-center justify-center gap-1">
              {row.bstRank !== null && (
                <ScoreChip
                  kind="BST"
                  letter={row.bstRank}
                  title={`BST Score: ${row.bstRank} — base stat total ${row.bst} vs Modern Emerald roster`}
                />
              )}
              {row.competitiveRank !== null && (
                <ScoreChip
                  kind="Comp"
                  letter={row.competitiveRank}
                  title={`Competitive Score: ${row.competitiveRank}${
                    row.competitiveReason
                      ? ` — ${row.competitiveReason}`
                      : ""
                  }`}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function ScoreChip({
  kind,
  letter,
  title,
}: {
  kind: "BST" | "Comp";
  letter: StatRank;
  title: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold leading-tight ${statRankToneClass(letter)}`}
      title={title}
    >
      <span className="font-semibold tracking-tight opacity-80">{kind}</span>
      <span aria-label={`${kind === "BST" ? "BST" : "Competitive"} Score: ${letter}`}>
        {letter}
      </span>
    </span>
  );
}
