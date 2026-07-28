import pokemonData from "@/data/pokemon.json";
import heldItemsData from "@/data/held-items.json";

export type PokemonIndexEntry = {
  name: string;
  pokedexId: number;
  slug: string;
  generation: number;
  /** True for PokeAPI alternate formes (IDs ≥ 10000). */
  isForme?: boolean;
};

export type HeldItemEntry = {
  slug: string;
  name: string;
};

export const POKEMON_INDEX = pokemonData.pokemon as PokemonIndexEntry[];
export const HELD_ITEMS = heldItemsData.items as HeldItemEntry[];

export const POKEMON_GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const POKEMON_BY_ID = new Map<number, PokemonIndexEntry>(
  POKEMON_INDEX.map((p) => [p.pokedexId, p]),
);

/** Base species only, National Dex order — for idle Pokédex browsing. */
export const BASE_SPECIES_BY_DEX: PokemonIndexEntry[] = POKEMON_INDEX.filter(
  (p) => !p.isForme,
).sort((a, b) => a.pokedexId - b.pokedexId);

const POKEMON_BY_NAME = new Map<string, PokemonIndexEntry>();
const POKEMON_BY_SLUG = new Map<string, PokemonIndexEntry>();
for (const p of BASE_SPECIES_BY_DEX) {
  POKEMON_BY_NAME.set(p.name.toLowerCase(), p);
  POKEMON_BY_SLUG.set(p.slug, p);
}
// Formes fill gaps only when no base species claims the key.
for (const p of POKEMON_INDEX) {
  if (!p.isForme) continue;
  const nameKey = p.name.toLowerCase();
  if (!POKEMON_BY_NAME.has(nameKey)) POKEMON_BY_NAME.set(nameKey, p);
  if (!POKEMON_BY_SLUG.has(p.slug)) POKEMON_BY_SLUG.set(p.slug, p);
}

export function searchPokemonIndex(
  query: string,
  options?: {
    generation?: number | null;
    /** When true, only alternate formes. When false, exclude formes. */
    formesOnly?: boolean | null;
    /** Omit to return the full filtered set. */
    limit?: number;
  },
): PokemonIndexEntry[] {
  const limit = options?.limit;
  const gen = options?.generation ?? null;
  const formesOnly = options?.formesOnly ?? null;
  const q = query.trim().toLowerCase();

  // Fast path: full National Dex browse (already sorted).
  if (!q && formesOnly === false) {
    const pool =
      gen == null
        ? BASE_SPECIES_BY_DEX
        : BASE_SPECIES_BY_DEX.filter((p) => p.generation === gen);
    return limit == null ? pool : pool.slice(0, limit);
  }

  let pool = POKEMON_INDEX;
  if (gen != null) pool = pool.filter((p) => p.generation === gen);
  if (formesOnly === true) pool = pool.filter((p) => p.isForme);
  if (formesOnly === false) pool = pool.filter((p) => !p.isForme);

  let hits: PokemonIndexEntry[];
  if (!q) {
    // Prefer base species when browsing; formes still appear when filtering/searching.
    hits =
      formesOnly == null
        ? [...pool].sort((a, b) => Number(a.isForme) - Number(b.isForme))
        : pool;
  } else {
    const asNum = Number(q);
    hits =
      Number.isFinite(asNum) && asNum > 0
        ? pool.filter((p) => p.pokedexId === asNum)
        : pool.filter(
            (p) => p.name.toLowerCase().includes(q) || p.slug.includes(q),
          );
  }

  return limit == null ? hits : hits.slice(0, limit);
}

export function findPokemonById(id: number): PokemonIndexEntry | undefined {
  return POKEMON_BY_ID.get(id);
}

/** Case-insensitive name / slug lookup (base species preferred over formes). */
export function findPokemonByName(
  nameOrSlug: string,
): PokemonIndexEntry | undefined {
  const q = nameOrSlug.trim().toLowerCase();
  if (!q) return undefined;
  const slug = q.replace(/\s+/g, "-");
  return (
    POKEMON_BY_NAME.get(q) ??
    POKEMON_BY_SLUG.get(slug) ??
    POKEMON_INDEX.find(
      (p) =>
        p.name.toLowerCase().includes(q) || p.slug.includes(slug),
    )
  );
}

export function searchHeldItems(query: string, limit = 40): HeldItemEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return HELD_ITEMS.slice(0, limit);
  return HELD_ITEMS.filter(
    (i) => i.name.toLowerCase().includes(q) || i.slug.includes(q.replace(/\s+/g, "-")),
  ).slice(0, limit);
}

export function heldItemSpriteUrl(slugOrName: string): string {
  const slug = slugOrName
    .trim()
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/\s+/g, "-");
  return `https://play.pokemonshowdown.com/sprites/itemicons/${slug}.png`;
}
