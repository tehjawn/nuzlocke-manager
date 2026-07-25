/**
 * Free/open sprite helpers.
 * Prefer PokeAPI numeric IDs; fall back to Showdown gen5 name sprites.
 * Trainers: Pokemon Showdown trainer sprite CDN.
 */

const SHOWDOWN_TRAINER_BASE =
  "https://play.pokemonshowdown.com/sprites/trainers";

const POKEAPI_SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

const SHOWDOWN_POKE_BASE = "https://play.pokemonshowdown.com/sprites/gen5";

/** Browseable Showdown sprite indexes (open in a new tab from pickers). */
export const SHOWDOWN_TRAINER_SPRITES_DIR =
  "https://play.pokemonshowdown.com/sprites/trainers/?sort=name&view=dir";
export const SHOWDOWN_POKEMON_SPRITES_DIR =
  "https://play.pokemonshowdown.com/sprites/gen5/?sort=name&view=dir";

/** Normalize spreadsheet-style names like "(Shiny) Charizard" or "Nidoran-M". */
export function parseSpeciesInput(raw: string): {
  species: string;
  isShiny: boolean;
  slug: string;
  showdownId: string;
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

  const showdownId = slug
    .replace(/-f$/, "f")
    .replace(/-m$/, "m")
    .replace(/-/g, "");

  return { species, isShiny, slug, showdownId };
}

export function pokemonSpriteUrl(
  speciesOrSlug: string,
  options?: { shiny?: boolean; pokedexId?: number | null },
): string {
  const { isShiny, showdownId } = parseSpeciesInput(speciesOrSlug);
  const shiny = options?.shiny ?? isShiny;
  const id = options?.pokedexId;

  if (id && id > 0) {
    return shiny
      ? `${POKEAPI_SPRITE_BASE}/shiny/${id}.png`
      : `${POKEAPI_SPRITE_BASE}/${id}.png`;
  }

  const folder = shiny ? `${SHOWDOWN_POKE_BASE}-shiny` : SHOWDOWN_POKE_BASE;
  return `${folder}/${showdownId}.png`;
}

export function trainerSpriteUrl(spriteKey: string): string {
  const key = spriteKey.replace(/\.png$/i, "").replace(/^.*\//, "");
  return `${SHOWDOWN_TRAINER_BASE}/${key}.png`;
}

export const DEFAULT_TRAINER_SPRITES = [
  "brendan",
  "may",
  "wally",
  "steven",
  "red",
  "leaf",
  "lucas",
  "dawn",
  "hilbert",
  "hilda",
  "nate",
  "rosa",
] as const;

/** Prefix for Pokémon species avatars stored in `avatarSpriteKey`. */
export const POKEMON_AVATAR_PREFIX = "poke:";

export type AvatarKind = "trainer" | "pokemon";

export type ParsedAvatar =
  | { kind: "trainer"; key: string }
  | { kind: "pokemon"; pokedexId: number | null; species: string };

export function trainerAvatarKey(key: string): string {
  return key.replace(/\.png$/i, "").replace(/^.*\//, "").toLowerCase();
}

export function pokemonAvatarKey(pokedexId: number, species?: string): string {
  if (pokedexId > 0) return `${POKEMON_AVATAR_PREFIX}${pokedexId}`;
  const slug = (species ?? "pikachu").trim() || "pikachu";
  return `${POKEMON_AVATAR_PREFIX}${slug}`;
}

export function parseAvatarKey(raw: string | null | undefined): ParsedAvatar {
  const value = (raw ?? "brendan").trim() || "brendan";
  if (value.toLowerCase().startsWith(POKEMON_AVATAR_PREFIX)) {
    const rest = value.slice(POKEMON_AVATAR_PREFIX.length).trim();
    const asId = Number(rest);
    if (Number.isFinite(asId) && asId > 0) {
      return { kind: "pokemon", pokedexId: asId, species: rest };
    }
    return { kind: "pokemon", pokedexId: null, species: rest || "Pikachu" };
  }
  return { kind: "trainer", key: trainerAvatarKey(value) };
}

/** Resolve board/card avatar URL for either trainer or Pokémon sprites. */
export function avatarImageUrl(raw: string | null | undefined): string {
  const parsed = parseAvatarKey(raw);
  if (parsed.kind === "pokemon") {
    return pokemonSpriteUrl(parsed.species, { pokedexId: parsed.pokedexId });
  }
  return trainerSpriteUrl(parsed.key);
}
