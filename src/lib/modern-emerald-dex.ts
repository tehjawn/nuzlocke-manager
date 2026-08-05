import { findPokemonById } from "@/data/pokemon-index";
import { MODERN_SPECIES_TO_NATIONAL } from "@/lib/gen3-save/layout";

let cachedIds: number[] | null = null;

/**
 * Unique positive National Dex IDs present in Modern Emerald (nzl_modern).
 * Includes Gen 1–3 + ME extras/formes (~430). Sorted ascending.
 */
export function modernEmeraldNationalIds(): number[] {
  if (cachedIds) return cachedIds;
  const set = new Set<number>();
  for (const id of MODERN_SPECIES_TO_NATIONAL) {
    if (id > 0) set.add(id);
  }
  cachedIds = [...set].sort((a, b) => a - b);
  return cachedIds;
}

export function modernEmeraldDexTotal(): number {
  return modernEmeraldNationalIds().length;
}

let cachedGenerations: number[] | null = null;

/**
 * National Dex generations the ROM actually draws from, ascending. Not 1–3:
 * Modern Emerald pulls a few dozen later-gen species in, so a generation
 * filter has to read the roster rather than assume a contiguous range.
 */
export function modernEmeraldGenerations(): number[] {
  if (cachedGenerations) return cachedGenerations;
  const set = new Set<number>();
  for (const id of modernEmeraldNationalIds()) {
    const generation = findPokemonById(id)?.generation;
    if (generation != null) set.add(generation);
  }
  cachedGenerations = [...set].sort((a, b) => a - b);
  return cachedGenerations;
}

/** Generation for an ME national id, or null when the species isn't catalogued. */
export function modernEmeraldGenerationOf(pokedexId: number): number | null {
  return findPokemonById(pokedexId)?.generation ?? null;
}

export type ModernEmeraldSpeciesRef = {
  pokedexId: number;
  species: string;
};

/** Resolve a display name for an ME national id (catalog name or fallback). */
export function modernEmeraldSpeciesRef(
  pokedexId: number,
): ModernEmeraldSpeciesRef {
  const entry = findPokemonById(pokedexId);
  return {
    pokedexId,
    species: entry?.name ?? `Species #${pokedexId}`,
  };
}
