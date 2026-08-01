export const POKEMON_SPRITE_PREF_STORAGE_KEY =
  "nuzlocke-pokemon-sprite-preference";
export const POKEMON_SPRITE_PREF_CHANGE_EVENT =
  "nuzlocke-pokemon-sprite-preference-change";

export type PokemonSpritePreference = "2d" | "animated";

export const DEFAULT_POKEMON_SPRITE_PREFERENCE: PokemonSpritePreference = "2d";

export function isPokemonSpritePreference(
  value: string | null | undefined,
): value is PokemonSpritePreference {
  return value === "2d" || value === "animated";
}

export function readPokemonSpritePreference(): PokemonSpritePreference {
  if (typeof window === "undefined") return DEFAULT_POKEMON_SPRITE_PREFERENCE;
  try {
    const stored = localStorage.getItem(POKEMON_SPRITE_PREF_STORAGE_KEY);
    return isPokemonSpritePreference(stored)
      ? stored
      : DEFAULT_POKEMON_SPRITE_PREFERENCE;
  } catch {
    return DEFAULT_POKEMON_SPRITE_PREFERENCE;
  }
}

export function writePokemonSpritePreference(
  preference: PokemonSpritePreference,
) {
  try {
    localStorage.setItem(POKEMON_SPRITE_PREF_STORAGE_KEY, preference);
  } catch {
    // private mode / blocked storage
  }
  window.dispatchEvent(new Event(POKEMON_SPRITE_PREF_CHANGE_EVENT));
}

export function subscribePokemonSpritePreference(
  onStoreChange: () => void,
): () => void {
  function onStorage(event: StorageEvent) {
    if (
      event.key !== POKEMON_SPRITE_PREF_STORAGE_KEY &&
      event.key !== null
    ) {
      return;
    }
    onStoreChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(
    POKEMON_SPRITE_PREF_CHANGE_EVENT,
    onStoreChange,
  );
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(
      POKEMON_SPRITE_PREF_CHANGE_EVENT,
      onStoreChange,
    );
  };
}
