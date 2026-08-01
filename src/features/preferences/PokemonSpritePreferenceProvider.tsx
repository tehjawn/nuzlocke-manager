"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEFAULT_POKEMON_SPRITE_PREFERENCE,
  readPokemonSpritePreference,
  subscribePokemonSpritePreference,
  type PokemonSpritePreference,
} from "@/features/preferences/pokemon-sprite-prefs";

const PokemonSpritePreferenceContext =
  createContext<PokemonSpritePreference>(DEFAULT_POKEMON_SPRITE_PREFERENCE);

export function PokemonSpritePreferenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const preference = useSyncExternalStore(
    subscribePokemonSpritePreference,
    readPokemonSpritePreference,
    () => DEFAULT_POKEMON_SPRITE_PREFERENCE,
  );

  return (
    <PokemonSpritePreferenceContext.Provider value={preference}>
      {children}
    </PokemonSpritePreferenceContext.Provider>
  );
}

export function usePokemonSpritePreference() {
  return useContext(PokemonSpritePreferenceContext);
}
