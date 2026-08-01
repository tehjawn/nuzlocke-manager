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
  mostPartyWipes: MemorialTrainerHighlight | null;
  mostDeathProne: MemorialSpeciesHighlight | null;
};

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

/**
 * Season-wide memorial callouts from live GRAVEYARD rows + wipe counts.
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
      .map((row) => row.trainer)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    heaviestMemorial = trainerHighlight(leaders, max);
  }

  let mostPartyWipes: MemorialTrainerHighlight | null = null;
  const wipeLeaders = trainers.filter((trainer) => (trainer.wipeCount ?? 0) > 0);
  if (wipeLeaders.length > 0) {
    const max = Math.max(...wipeLeaders.map((trainer) => trainer.wipeCount ?? 0));
    const leaders = wipeLeaders
      .filter((trainer) => (trainer.wipeCount ?? 0) === max)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    mostPartyWipes = trainerHighlight(leaders, max);
  }

  const speciesCounts = new Map<
    string,
    { species: string; pokedexId: number | null; count: number }
  >();
  for (const row of rows) {
    for (const mon of row.graves) {
      const key =
        mon.pokedexId != null
          ? `id:${mon.pokedexId}`
          : `name:${mon.species.toLowerCase()}`;
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

  let mostDeathProne: MemorialSpeciesHighlight | null = null;
  if (speciesCounts.size > 0) {
    const ranked = [...speciesCounts.values()].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.species.localeCompare(b.species);
    });
    const top = ranked[0]!;
    const tied = ranked.filter((entry) => entry.count === top.count).length > 1;
    mostDeathProne = {
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
    mostPartyWipes,
    mostDeathProne,
  };
}
