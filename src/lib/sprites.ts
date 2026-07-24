/**
 * Free/open sprite helpers.
 * Pokémon: PokeAPI GitHub sprites + Showdown Dex fallbacks.
 * Trainers: Pokemon Showdown trainer sprite CDN (matches the spreadsheet).
 */

const SHOWDOWN_TRAINER_BASE =
  "https://play.pokemonshowdown.com/sprites/trainers";

const POKEAPI_SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

/** Normalize spreadsheet-style names like "(Shiny) Charizard" or "Nidoran-M". */
export function parseSpeciesInput(raw: string): {
  species: string;
  isShiny: boolean;
  slug: string;
} {
  const trimmed = raw.trim();
  const shinyMatch = trimmed.match(/^\(shiny\)\s*(.+)$/i);
  const isShiny = Boolean(shinyMatch);
  const species = (shinyMatch?.[1] ?? trimmed).trim();

  const slug = species
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/\s+/g, "-")
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m");

  return { species, isShiny, slug };
}

export function pokemonSpriteUrl(
  speciesOrSlug: string,
  options?: { shiny?: boolean; officialArtwork?: boolean },
): string {
  const { slug, isShiny } = parseSpeciesInput(speciesOrSlug);
  const shiny = options?.shiny ?? isShiny;

  if (options?.officialArtwork) {
    const folder = shiny ? "other/official-artwork/shiny" : "other/official-artwork";
    return `${POKEAPI_SPRITE_BASE}/${folder}/${slug}.png`;
  }

  // Numeric IDs are preferred by PokeAPI paths; slug-based Showdown fallback used later in UI.
  return shiny
    ? `${POKEAPI_SPRITE_BASE}/shiny/${slug}.png`
    : `${POKEAPI_SPRITE_BASE}/${slug}.png`;
}

export function showdownPokemonSpriteUrl(
  speciesOrSlug: string,
  options?: { shiny?: boolean },
): string {
  const { slug, isShiny } = parseSpeciesInput(speciesOrSlug);
  const shiny = options?.shiny ?? isShiny;
  const base = shiny
    ? "https://play.pokemonshowdown.com/sprites/ani-shiny"
    : "https://play.pokemonshowdown.com/sprites/ani";
  return `${base}/${slug}.gif`;
}

export function trainerSpriteUrl(spriteKey: string): string {
  const key = spriteKey.replace(/\.png$/i, "").replace(/^.*\//, "");
  return `${SHOWDOWN_TRAINER_BASE}/${key}.png`;
}

export const DEFAULT_TRAINER_SPRITES = [
  "red",
  "leaf",
  "brendan",
  "may",
  "lucas",
  "dawn",
  "hilbert",
  "hilda",
  "nate",
  "rosa",
  "calem",
  "serena",
  "elio",
  "selene",
  "victor",
  "gloria",
] as const;
