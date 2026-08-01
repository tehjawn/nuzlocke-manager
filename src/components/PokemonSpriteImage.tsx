"use client";

import { useState } from "react";
import { usePokemonSpritePreference } from "@/features/preferences/PokemonSpritePreferenceProvider";
import {
  pokemonAnimatedSpriteUrl,
  pokemonSpriteUrl,
} from "@/lib/sprites";

type PokemonSpriteImageProps = {
  alt: string;
  className?: string;
  decoding?: "async" | "auto" | "sync";
  height: number;
  loading?: "eager" | "lazy";
  pokedexId?: number | null;
  shiny?: boolean;
  species: string;
  width: number;
};

export function PokemonSpriteImage({
  alt,
  className = "",
  decoding = "async",
  height,
  loading,
  pokedexId,
  shiny = false,
  species,
  width,
}: PokemonSpriteImageProps) {
  const preference = usePokemonSpritePreference();
  const stillSrc = pokemonSpriteUrl(species, { pokedexId, shiny });
  const animatedSrc = pokemonAnimatedSpriteUrl(species, { shiny });
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showAnimated = preference === "animated" && failedSrc !== animatedSrc;
  const displaySrc = showAnimated ? animatedSrc : stillSrc;
  const displayClassName = showAnimated
    ? className.replace(/\bpixelated\b/g, "").replace(/\s+/g, " ").trim()
    : className;

  return (
    <picture className="contents">
      {showAnimated ? (
        <source media="(prefers-reduced-motion: reduce)" srcSet={stillSrc} />
      ) : null}
      <img
        alt={alt}
        className={displayClassName}
        decoding={decoding}
        height={height}
        key={displaySrc}
        loading={loading}
        onError={() => {
          if (showAnimated) setFailedSrc(animatedSrc);
        }}
        src={displaySrc}
        width={width}
      />
    </picture>
  );
}
