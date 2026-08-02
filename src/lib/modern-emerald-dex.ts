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
