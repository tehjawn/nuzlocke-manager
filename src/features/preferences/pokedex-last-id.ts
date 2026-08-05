/**
 * Last focused Pokédex species in the Tools directory.
 * localStorage + useSyncExternalStore (same idea as theme / fx-prefs).
 */

export const POKEDEX_LAST_ID_STORAGE_KEY = "nuzlocke-pokedex-last-id";

/** National Dex #1 — Bulbasaur. Fallback when nothing is remembered. */
export const DEFAULT_POKEDEX_ID = 1;

/** `undefined` = not read yet this session. */
let cachedLastId: number | null | undefined;

function loadFromStorage(): number | null {
  try {
    const stored = localStorage.getItem(POKEDEX_LAST_ID_STORAGE_KEY);
    if (stored == null) return null;
    const id = Number(stored);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** Client snapshot for `useSyncExternalStore`. Cached after first read. */
export function readPokedexLastId(): number | null {
  if (typeof window === "undefined") return null;
  if (cachedLastId !== undefined) return cachedLastId;
  cachedLastId = loadFromStorage();
  return cachedLastId;
}

/** SSR / hydration snapshot — must match the server render (no remembered id). */
export function getPokedexLastIdServerSnapshot(): null {
  return null;
}

export function writePokedexLastId(pokedexId: number) {
  if (!(Number.isFinite(pokedexId) && pokedexId > 0)) return;
  if (cachedLastId === pokedexId) return;
  cachedLastId = pokedexId;
  try {
    localStorage.setItem(POKEDEX_LAST_ID_STORAGE_KEY, String(pokedexId));
  } catch {
    // private mode / blocked storage
  }
}

/** Cross-tab `storage` only — same-tab UI is driven by local pick state. */
export function subscribePokedexLastId(onStoreChange: () => void): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key !== POKEDEX_LAST_ID_STORAGE_KEY && event.key !== null) {
      return;
    }
    cachedLastId = loadFromStorage();
    onStoreChange();
  }
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
