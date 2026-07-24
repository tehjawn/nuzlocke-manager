import pokemonData from "@/data/pokemon.json";
import heldItemsData from "@/data/held-items.json";

export type PokemonIndexEntry = {
  name: string;
  pokedexId: number;
  slug: string;
  generation: number;
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
  options?: { generation?: number | null; limit?: number },
): PokemonIndexEntry[] {
  const limit = options?.limit ?? 80;
  const gen = options?.generation ?? null;
  const q = query.trim().toLowerCase();
  let pool = POKEMON_INDEX;
  if (gen != null) pool = pool.filter((p) => p.generation === gen);

  if (!q) return pool.slice(0, limit);

  const asNum = Number(q);
  if (Number.isFinite(asNum) && asNum > 0) {
    return pool.filter((p) => p.pokedexId === asNum).slice(0, limit);
  }
  return pool
    .filter((p) => p.name.toLowerCase().includes(q) || p.slug.includes(q))
    .slice(0, limit);
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
