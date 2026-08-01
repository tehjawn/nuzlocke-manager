import type { TrainerProfile } from "@/lib/challenge-types";
import { displayName, pokemonInSlot } from "@/lib/trainer-display";

export type MemorialTrainerHighlight = {
  trainerIds: string[];
  labels: string[];
  count: number;
  tied: boolean;
};

export type MemorialSpeciesHighlight = {
  species: string;
  pokedexId: number | null;
  count: number;
  tied: boolean;
};

export type MemorialSeasonHighlights = {
  totalGraves: number;
  trainersWithLosses: number;
  heaviestMemorial: MemorialTrainerHighlight | null;
  mostMourned: MemorialSpeciesHighlight | null;
};

/**
 * Season-wide memorial callouts from live GRAVEYARD rows.
 * Ties keep every leader (callouts can truncate in UI).
 */
export function memorialSeasonHighlights(
  trainers: TrainerProfile[],
): MemorialSeasonHighlights {
  const rows = trainers
    .map((trainer) => ({
      trainer,
      graves: pokemonInSlot(trainer, "GRAVEYARD"),
    }))
    .filter((row) => row.graves.length > 0);

  const totalGraves = rows.reduce((sum, row) => sum + row.graves.length, 0);

  let heaviestMemorial: MemorialTrainerHighlight | null = null;
  if (rows.length > 0) {
    const max = Math.max(...rows.map((row) => row.graves.length));
    const leaders = rows
      .filter((row) => row.graves.length === max)
      .sort((a, b) => a.trainer.sortOrder - b.trainer.sortOrder);
    heaviestMemorial = {
      trainerIds: leaders.map((row) => row.trainer.id),
      labels: leaders.map((row) => displayName(row.trainer)),
      count: max,
      tied: leaders.length > 1,
    };
  }

  const speciesCounts = new Map<
    string,
    { species: string; pokedexId: number | null; count: number }
  >();
  for (const row of rows) {
    for (const mon of row.graves) {
      const key = mon.pokedexId != null ? `id:${mon.pokedexId}` : `name:${mon.species.toLowerCase()}`;
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

  let mostMourned: MemorialSpeciesHighlight | null = null;
  if (speciesCounts.size > 0) {
    const ranked = [...speciesCounts.values()].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.species.localeCompare(b.species);
    });
    const top = ranked[0]!;
    const tied = ranked.filter((entry) => entry.count === top.count).length > 1;
    mostMourned = {
      species: top.species,
      pokedexId: top.pokedexId,
      count: top.count,
      tied,
    };
  }

  return {
    totalGraves,
    trainersWithLosses: rows.length,
    heaviestMemorial,
    mostMourned,
  };
}
