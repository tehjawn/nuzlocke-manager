/**
 * Season-wide **specimen** board — one row per actual Pokémon on any trainer's
 * board, as opposed to `speciesOwnershipBoard`'s one row per dex entry.
 *
 * Every grade here is borrowed, never re-derived: catch tier comes from
 * `specimenCatchTier`, BST tier from `baseStatRanksFor`. Pokémon Ownership's
 * Showcase renders it; Season Stats (#178) should aggregate the same rows
 * rather than recomputing a second, drifting ladder.
 */

import { findPokemonById } from "@/data/pokemon-index";
import type {
  PokemonEntry,
  PokemonSlot,
  TrainerProfile,
} from "@/lib/challenge-types";
import { resolvePokedexId } from "@/lib/encounter-stats";
import {
  catchTierRank,
  specimenCatchTier,
  type CatchTier,
} from "@/lib/iv-quality";
import type { PokemonType } from "@/lib/pokemon-types";
import { resolvePokemonTypes } from "@/lib/resolve-pokemon-types";
import { baseStatRanksFor, STAT_RANKS, type StatRank } from "@/lib/species-ranks";
import { calcBattleStats, calcMaxBattleStats, isEmptySpread } from "@/lib/stats";

/** Slots that represent a Pokémon still in play (i.e. not memorialized). */
export const LIVING_SLOTS: ReadonlySet<PokemonSlot> = new Set([
  "MAIN",
  "RESERVE",
  "ENCOUNTERED",
]);

export type SpecimenRow = {
  /** `PokemonEntry.id` — unique across the season, so it doubles as a React key. */
  id: string;
  /** The entry as the viewer received it (already redacted where applicable). */
  pokemon: PokemonEntry;
  trainerId: string;
  trainerHandle: string;
  /** Trainer board order, for the "by trainer" sort. */
  trainerSortOrder: number;
  species: string;
  nickname: string | null;
  /** Resolved dex id — null only when the species can't be identified at all. */
  pokedexId: number | null;
  level: number | null;
  isShiny: boolean;
  slot: PokemonSlot;
  /** Resolved types (stored → catalog by id → catalog by name). */
  types: PokemonType[];
  /** National Dex generation; null for unidentifiable species / formes. */
  generation: number | null;
  /** Base stat total; null when the species has no catalogued base stats. */
  bst: number | null;
  /** F→S rank of that BST against the Modern Emerald roster; null with `bst`. */
  bstRank: StatRank | null;
  /**
   * Catch tier, or null when it can't be shown. Two different nulls, hence
   * `catchTierHidden`: withheld from this viewer vs. genuinely nothing on file.
   */
  catchTier: CatchTier | null;
  /** True when this trainer's IVs are redacted for the viewer. */
  catchTierHidden: boolean;
  /** Lowercased haystack for the search box (species, nickname, handle, dex, route). */
  searchText: string;
};

/** `baseStatRanksFor` walks the whole peer pool — one call per species, not per row. */
type RankCache = Map<number, ReturnType<typeof baseStatRanksFor>>;

function rankFor(cache: RankCache, pokedexId: number | null) {
  if (pokedexId == null) return null;
  if (!cache.has(pokedexId)) cache.set(pokedexId, baseStatRanksFor(pokedexId));
  return cache.get(pokedexId) ?? null;
}

/**
 * Grade one specimen exactly the way `PokemonDetailsModal` does, so a row and
 * the modal it opens never disagree: an all-zero spread counts as "no data"
 * rather than six dump IVs, and battle stats promote only when derivable.
 *
 * Returns null when there is nothing to grade — the caller decides whether
 * that reads as "hidden" or "not recorded".
 *
 * Deliberately reads `pokemon.pokedexId` rather than the row's name-resolved
 * id: the modal grades off the raw column, and a row that disagreed with the
 * card it opens would be worse than a legacy row grading one notch low.
 */
function gradeCatchTier(pokemon: PokemonEntry): CatchTier | null {
  const ivs = isEmptySpread(pokemon.ivs) ? null : pokemon.ivs;
  const evs = isEmptySpread(pokemon.evs) ? null : pokemon.evs;
  if (!ivs && !evs) return null;

  const battle = calcBattleStats({
    pokedexId: pokemon.pokedexId,
    level: pokemon.level,
    ivs: pokemon.ivs,
    evs: pokemon.evs,
    nature: pokemon.nature,
  });
  const battleMax = calcMaxBattleStats({
    pokedexId: pokemon.pokedexId,
    level: pokemon.level,
  });
  return specimenCatchTier({ ivs, evs, battle, battleMax });
}

/**
 * Flatten every trainer's box into specimen rows.
 *
 * `competitiveTrainerIds` is the set whose IVs survived
 * `redactTrainerCompetitiveDetails` for this viewer — own board always, plus
 * everyone when a GM has the lens on. Rows outside it are graded `null` and
 * flagged hidden; the tier is never inferred from a redacted payload.
 */
export function seasonSpecimenBoard(
  trainers: TrainerProfile[],
  options?: { competitiveTrainerIds?: Iterable<string> },
): SpecimenRow[] {
  const canGrade = new Set(options?.competitiveTrainerIds ?? []);
  const rankCache: RankCache = new Map();
  const rows: SpecimenRow[] = [];

  for (const trainer of trainers) {
    const graded = canGrade.has(trainer.id);
    for (const pokemon of trainer.pokemon) {
      const pokedexId = resolvePokedexId(pokemon);
      const ranks = rankFor(rankCache, pokedexId);
      const catchTier = graded ? gradeCatchTier(pokemon) : null;

      rows.push({
        id: pokemon.id,
        pokemon,
        trainerId: trainer.id,
        trainerHandle: trainer.handle,
        trainerSortOrder: trainer.sortOrder,
        species: pokemon.species,
        nickname: pokemon.nickname,
        pokedexId,
        level: pokemon.level,
        isShiny: pokemon.isShiny,
        slot: pokemon.slot,
        types: resolvePokemonTypes({
          types: pokemon.types,
          pokedexId,
          species: pokemon.species,
        }),
        generation:
          pokedexId != null
            ? (findPokemonById(pokedexId)?.generation ?? null)
            : null,
        bst: ranks?.bst.value ?? null,
        bstRank: ranks?.bst.rank ?? null,
        catchTier,
        catchTierHidden: !graded,
        searchText: [
          pokemon.species,
          pokemon.nickname ?? "",
          trainer.handle,
          pokemon.catchRoute ?? "",
          pokedexId != null ? String(pokedexId) : "",
        ]
          .join(" ")
          .toLowerCase(),
      });
    }
  }

  return rows;
}

export type SpecimenSlotScope =
  | "living"
  | "all"
  | "MAIN"
  | "RESERVE"
  | "ENCOUNTERED"
  | "GRAVEYARD";

export type SpecimenFilters = {
  trainerId: string | null;
  type: PokemonType | null;
  generation: number | null;
  slot: SpecimenSlotScope;
  shinyOnly: boolean;
  catchTier: CatchTier | null;
  bstRank: StatRank | null;
  /** Already lowercased and trimmed. */
  query: string;
};

export function specimenMatchesSlotScope(
  slot: PokemonSlot,
  scope: SpecimenSlotScope,
): boolean {
  if (scope === "all") return true;
  if (scope === "living") return LIVING_SLOTS.has(slot);
  return slot === scope;
}

export function specimenMatchesFilters(
  row: SpecimenRow,
  filters: SpecimenFilters,
): boolean {
  if (!specimenMatchesSlotScope(row.slot, filters.slot)) return false;
  if (filters.trainerId && row.trainerId !== filters.trainerId) return false;
  if (filters.type && !row.types.includes(filters.type)) return false;
  if (filters.generation != null && row.generation !== filters.generation) {
    return false;
  }
  if (filters.shinyOnly && !row.isShiny) return false;
  // A hidden or ungraded row can't satisfy a tier filter — it has no tier.
  if (filters.catchTier && row.catchTier !== filters.catchTier) return false;
  if (filters.bstRank && row.bstRank !== filters.bstRank) return false;
  if (filters.query && !row.searchText.includes(filters.query)) return false;
  return true;
}

export type SpecimenSort =
  | "dex"
  | "level"
  | "catch"
  | "bst"
  | "trainer"
  | "alpha";

const SLOT_ORDER: Record<PokemonSlot, number> = {
  MAIN: 0,
  RESERVE: 1,
  ENCOUNTERED: 2,
  GRAVEYARD: 3,
};

/**
 * Nulls always sink, whichever way the column points: a species with no
 * catalogued base stats, a box mon with no level, and a redacted catch tier
 * are all "unknown", and unknowns belong under the answers rather than
 * winning a descending sort by being absent.
 */
function compareNullable(
  a: number | null,
  b: number | null,
  direction: "asc" | "desc",
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === "asc" ? a - b : b - a;
}

/** Stable, fully-specified fallback so equal rows never shuffle between renders. */
function compareIdentity(a: SpecimenRow, b: SpecimenRow): number {
  const dex = compareNullable(a.pokedexId, b.pokedexId, "asc");
  if (dex !== 0) return dex;
  const species = a.species.localeCompare(b.species);
  if (species !== 0) return species;
  if (a.trainerSortOrder !== b.trainerSortOrder) {
    return a.trainerSortOrder - b.trainerSortOrder;
  }
  const handle = a.trainerHandle.localeCompare(b.trainerHandle);
  if (handle !== 0) return handle;
  if (SLOT_ORDER[a.slot] !== SLOT_ORDER[b.slot]) {
    return SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot];
  }
  return a.id.localeCompare(b.id);
}

export function compareSpecimenRows(
  a: SpecimenRow,
  b: SpecimenRow,
  sort: SpecimenSort,
): number {
  let primary = 0;
  if (sort === "level") {
    primary = compareNullable(a.level, b.level, "desc");
  } else if (sort === "catch") {
    primary = compareNullable(
      a.catchTier ? catchTierRank(a.catchTier) : null,
      b.catchTier ? catchTierRank(b.catchTier) : null,
      "desc",
    );
  } else if (sort === "bst") {
    // Rank letter is the visible column, but BST breaks ties inside a letter.
    primary = compareNullable(
      a.bstRank ? STAT_RANKS.indexOf(a.bstRank) : null,
      b.bstRank ? STAT_RANKS.indexOf(b.bstRank) : null,
      "desc",
    );
    if (primary === 0) primary = compareNullable(a.bst, b.bst, "desc");
  } else if (sort === "trainer") {
    primary =
      a.trainerSortOrder - b.trainerSortOrder ||
      a.trainerHandle.localeCompare(b.trainerHandle);
  } else if (sort === "alpha") {
    primary = a.species.localeCompare(b.species);
  }
  return primary !== 0 ? primary : compareIdentity(a, b);
}

export function sortSpecimenRows(
  rows: SpecimenRow[],
  sort: SpecimenSort,
): SpecimenRow[] {
  return [...rows].sort((a, b) => compareSpecimenRows(a, b, sort));
}
