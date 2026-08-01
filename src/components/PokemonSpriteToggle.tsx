"use client";

import { usePokemonSpritePreference } from "@/features/preferences/PokemonSpritePreferenceProvider";
import { writePokemonSpritePreference } from "@/features/preferences/pokemon-sprite-prefs";

/**
 * Footer control: toggle static (2D) vs animated (3D) Pokémon sprites.
 * Shares the same preference as Player Preferences.
 */
export function PokemonSpriteToggle() {
  const preference = usePokemonSpritePreference();
  const isAnimated = preference === "animated";
  const nextLabel = isAnimated ? "2D" : "3D";

  return (
    <button
      type="button"
      onClick={() =>
        writePokemonSpritePreference(isAnimated ? "2d" : "animated")
      }
      aria-label={`Switch to ${nextLabel} Pokémon sprites`}
      title={`Pokémon sprites: ${isAnimated ? "3D" : "2D"} (click for ${nextLabel})`}
      aria-pressed={isAnimated}
      className="pressable inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-frame bg-surface text-[10px] font-bold tracking-tight text-ink hover:border-interactive/50"
    >
      {isAnimated ? "3D" : "2D"}
    </button>
  );
}
