/**
 * Last focused Pokédex species in the Tools directory.
 * localStorage only — restores focus when opening without `?id=`.
 */

export const POKEDEX_LAST_ID_STORAGE_KEY = "nuzlocke-pokedex-last-id";

/** National Dex #1 — Bulbasaur. Fallback when nothing is remembered. */
export const DEFAULT_POKEDEX_ID = 1;

export function readPokedexLastId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(POKEDEX_LAST_ID_STORAGE_KEY);
    if (stored == null) return null;
    const id = Number(stored);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function writePokedexLastId(pokedexId: number) {
  if (!(Number.isFinite(pokedexId) && pokedexId > 0)) return;
  try {
    localStorage.setItem(POKEDEX_LAST_ID_STORAGE_KEY, String(pokedexId));
  } catch {
    // private mode / blocked storage
  }
}
