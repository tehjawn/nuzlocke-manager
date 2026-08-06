import { findPokemonById } from "@/data/pokemon-index";
import type { PokemonEntry, TrainerProfile } from "@/lib/challenge-types";
import type { PokemonType } from "@/lib/pokemon-types";
import { displayName } from "@/lib/trainer-display";

/** How many rows memorial callout lists show (matches encounter top-N). */
export const MEMORIAL_STATS_TOP_N = 3;

export type MemorialTrainerHighlight = {
  trainerIds: string[];
  labels: string[];
  count: number;
  tied: boolean;
};

/** Ranked trainer row for heaviest memorial / wipe callouts. */
export type MemorialTrainerStanding = {
  trainerId: string;
  label: string;
  count: number;
};

export type MemorialSpeciesHighlight = {
  species: string;
  pokedexId: number | null;
  count: number;
};

export type MemorialSeasonHighlights = {
  totalGraves: number;
  trainersWithLosses: number;
  heaviestMemorial: MemorialTrainerStanding[];
  mostPartyWipes: MemorialTrainerStanding[];
  mostDeathProne: MemorialSpeciesHighlight[];
  /** Highest last-imported Pokédollars (issue 146). */
  richest: MemorialTrainerHighlight | null;
};

/** "A", "A & B", or "A, B +2" — compact display for tied leader labels. */
export function formatTiedLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
}

function trainerHighlight(
  leaders: TrainerProfile[],
  count: number,
): MemorialTrainerHighlight {
  return {
    trainerIds: leaders.map((trainer) => trainer.id),
    labels: leaders.map((trainer) => displayName(trainer)),
    count,
    tied: leaders.length > 1,
  };
}

function topTrainerStandings(
  rows: Array<{ trainer: TrainerProfile; count: number }>,
  limit = MEMORIAL_STATS_TOP_N,
): MemorialTrainerStanding[] {
  return [...rows]
    .filter((row) => row.count > 0)
    .sort(
      (a, b) =>
        b.count - a.count || a.trainer.sortOrder - b.trainer.sortOrder,
    )
    .slice(0, limit)
    .map((row) => ({
      trainerId: row.trainer.id,
      label: displayName(row.trainer),
      count: row.count,
    }));
}

/**
 * Season-wide memorial callouts from cross-run graves + wipe counts.
 * Heaviest memorial, wipe, and death-prone callouts return top N rows.
 *
 * Graves are passed in rather than read off `trainer.pokemon`: a wipe clears
 * the live board, so past-run graves only exist in board history.
 */
export function memorialSeasonHighlights(
  trainers: TrainerProfile[],
  gravesByTrainerId: Record<string, PokemonEntry[]>,
): MemorialSeasonHighlights {
  const rows = trainers
    .map((trainer) => ({
      trainer,
      graves: gravesByTrainerId[trainer.id] ?? [],
    }))
    .filter((row) => row.graves.length > 0);

  const totalGraves = rows.reduce((sum, row) => sum + row.graves.length, 0);

  const heaviestMemorial = topTrainerStandings(
    rows.map((row) => ({ trainer: row.trainer, count: row.graves.length })),
  );

  const mostPartyWipes = topTrainerStandings(
    trainers.map((trainer) => ({
      trainer,
      count: trainer.wipeCount ?? 0,
    })),
  );

  const speciesCounts = new Map<
    string,
    { species: string; pokedexId: number | null; count: number }
  >();
  for (const row of rows) {
    for (const mon of row.graves) {
      const key = mon.species.trim().toLowerCase();
      const existing = speciesCounts.get(key);
      if (existing) {
        existing.count += 1;
        if (existing.pokedexId == null && mon.pokedexId != null) {
          existing.pokedexId = mon.pokedexId;
        }
      } else {
        speciesCounts.set(key, {
          species: mon.species,
          pokedexId: mon.pokedexId,
          count: 1,
        });
      }
    }
  }

  const mostDeathProne = [...speciesCounts.values()]
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.species.localeCompare(b.species);
    })
    .slice(0, MEMORIAL_STATS_TOP_N)
    .map((entry) => ({
      species: entry.species,
      pokedexId: entry.pokedexId,
      count: entry.count,
    }));

  let richest: MemorialTrainerHighlight | null = null;
  const moneyLeaders = trainers.filter(
    (trainer) => trainer.money != null && trainer.money >= 0,
  );
  if (moneyLeaders.length > 0) {
    const max = Math.max(...moneyLeaders.map((trainer) => trainer.money ?? 0));
    const leaders = moneyLeaders
      .filter((trainer) => (trainer.money ?? 0) === max)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    richest = trainerHighlight(leaders, max);
  }

  return {
    totalGraves,
    trainersWithLosses: rows.length,
    heaviestMemorial,
    mostPartyWipes,
    mostDeathProne,
    richest,
  };
}

export type MemorialPokemonFilters = {
  /** Empty = all types. Match if the mon has any selected type. */
  types: PokemonType[];
  /** Empty = all generations. Match if National Dex gen is selected. */
  generations: number[];
};

/** True when the grave matches optional type and/or National Dex generation filters. */
export function memorialPokemonMatchesFilters(
  pokemon: Pick<PokemonEntry, "types" | "pokedexId">,
  filters: MemorialPokemonFilters,
): boolean {
  if (
    filters.types.length > 0 &&
    !filters.types.some((type) => pokemon.types.includes(type))
  ) {
    return false;
  }
  if (filters.generations.length > 0) {
    const gen =
      pokemon.pokedexId != null
        ? (findPokemonById(pokemon.pokedexId)?.generation ?? null)
        : null;
    if (gen == null || !filters.generations.includes(gen)) return false;
  }
  return true;
}
