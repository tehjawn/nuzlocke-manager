import { findSpecies } from "@/data/species";
import typesData from "@/data/pokemon-types-by-id.json";
import { POKEMON_TYPES, type PokemonType } from "@/lib/pokemon-types";

const TYPES_BY_ID = typesData.typesById as Record<string, string[]>;

function asTypes(types: string[] | null | undefined): PokemonType[] {
  if (!types?.length) return [];
  return types.filter((t): t is PokemonType =>
    (POKEMON_TYPES as readonly string[]).includes(t),
  );
}

/** Types for a PokeAPI / National Dex id (includes forme ids ≥ 10000). */
export function typesForPokedexId(
  pokedexId: number | null | undefined,
): PokemonType[] {
  if (pokedexId == null || pokedexId <= 0) return [];
  return asTypes(TYPES_BY_ID[String(pokedexId)]);
}

/**
 * Prefer stored types; otherwise catalog by pokedexId, then SPECIES_INDEX name.
 * Keeps older rows with empty `types[]` usable in the UI.
 */
export function resolvePokemonTypes(input: {
  types?: string[] | null;
  pokedexId?: number | null;
  species?: string | null;
}): PokemonType[] {
  const stored = asTypes(input.types);
  if (stored.length > 0) return stored;

  const byId = typesForPokedexId(input.pokedexId);
  if (byId.length > 0) return byId;

  const species = input.species?.trim();
  if (!species) return [];
  return asTypes(findSpecies(species)?.types);
}
