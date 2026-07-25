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
  return POKEMON_INDEX.find((p) => p.pokedexId === id);
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
