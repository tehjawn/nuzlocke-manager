/**
 * Free/open sprite helpers.
 * Prefer PokeAPI numeric IDs; fall back to Showdown gen5 name sprites.
 * Trainers: Pokemon Showdown trainer sprite CDN.
 */

import { findPokemonById } from "@/data/pokemon-index";

const SHOWDOWN_TRAINER_BASE =
  "https://play.pokemonshowdown.com/sprites/trainers";

const POKEAPI_SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

const SHOWDOWN_POKE_BASE = "https://play.pokemonshowdown.com/sprites/gen5";
const SHOWDOWN_ANI_BASE = "https://play.pokemonshowdown.com/sprites/ani";

/** Browseable Showdown sprite indexes (open in a new tab from pickers). */
export const SHOWDOWN_TRAINER_SPRITES_DIR =
  "https://play.pokemonshowdown.com/sprites/trainers/?sort=name&view=dir";
export const SHOWDOWN_POKEMON_SPRITES_DIR =
  "https://play.pokemonshowdown.com/sprites/gen5/?sort=name&view=dir";
export const SHOWDOWN_ANI_SPRITES_DIR =
  "https://play.pokemonshowdown.com/sprites/ani/?sort=name&view=dir";

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

/** Prefix for Pokémon species avatars stored in `avatarSpriteKey`. */
export const POKEMON_AVATAR_PREFIX = "poke:";

/**
 * Prefix for Showdown animated (`/sprites/ani/`) Pokémon avatars.
 * Same id/species payload as `poke:` — only the render source differs.
 */
export const POKEMON_ANI_AVATAR_PREFIX = "pokeani:";

/** Prefix for custom avatars (`custom:https://…`) — uploads or hotlinked URLs. */
export const CUSTOM_AVATAR_PREFIX = "custom:";

/**
 * Max length of the HTTPS URL portion of a `custom:` key.
 * Keeps stored keys bounded while allowing typical CDN query strings.
 */
export const CUSTOM_IMAGE_URL_MAX_LENGTH = 1000;

/** Chars that must not appear raw in CSS `url()` / attribute contexts. */
const UNSAFE_CUSTOM_URL_CHARS = /["'()\\\s<>]/;

export type AvatarKind = "trainer" | "pokemon" | "pokemon-ani" | "custom";

export type ParsedAvatar =
  | { kind: "trainer"; key: string }
  | { kind: "pokemon"; pokedexId: number | null; species: string }
  | { kind: "pokemon-ani"; pokedexId: number | null; species: string }
  | { kind: "custom"; url: string };

export function trainerAvatarKey(key: string): string {
  return key.replace(/\.png$/i, "").replace(/^.*\//, "").toLowerCase();
}

export function pokemonAvatarKey(pokedexId: number, species?: string): string {
  if (pokedexId > 0) return `${POKEMON_AVATAR_PREFIX}${pokedexId}`;
  const slug = (species ?? "pikachu").trim() || "pikachu";
  return `${POKEMON_AVATAR_PREFIX}${slug}`;
}

export function pokemonAnimatedAvatarKey(
  pokedexId: number,
  species?: string,
): string {
  if (pokedexId > 0) return `${POKEMON_ANI_AVATAR_PREFIX}${pokedexId}`;
  const slug = (species ?? "pikachu").trim() || "pikachu";
  return `${POKEMON_ANI_AVATAR_PREFIX}${slug}`;
}

/**
 * Showdown `/sprites/ani/` filename stem. Mostly the dex slug, with mega-x/y
 * collapsed the way Showdown names those files (`charizard-megax.gif`).
 */
export function pokemonAnimatedSpriteId(speciesOrSlug: string): string {
  const { slug } = parseSpeciesInput(speciesOrSlug);
  return slug.replace(/-mega-x$/, "-megax").replace(/-mega-y$/, "-megay");
}

export function pokemonAnimatedSpriteUrl(speciesOrSlug: string): string {
  return `${SHOWDOWN_ANI_BASE}/${pokemonAnimatedSpriteId(speciesOrSlug)}.gif`;
}

export function customAvatarKey(url: string): string {
  return `${CUSTOM_AVATAR_PREFIX}${url.trim()}`;
}

function isBlockedCustomImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }
  // Prefer named public hosts over literal IPs.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(":")) return true;
  return false;
}

/**
 * Normalize a pasted HTTPS URL or `custom:https://…` key to a canonical href.
 * Returns `null` when the value is missing, unsafe, or not an allowed URL.
 */
export function normalizeCustomImageUrl(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = trimmed.toLowerCase().startsWith(CUSTOM_AVATAR_PREFIX)
    ? trimmed.slice(CUSTOM_AVATAR_PREFIX.length).trim()
    : trimmed;
  // Reject breakout chars before URL() percent-encodes them away.
  if (UNSAFE_CUSTOM_URL_CHARS.test(candidate)) return null;
  try {
    const href = new URL(candidate).href;
    if (!isAllowedCustomAvatarUrl(href)) return null;
    return href;
  } catch {
    return null;
  }
}

/** Build a stored `custom:…` key from a pasted URL or existing custom key. */
export function customImageKeyFromInput(
  raw: string | null | undefined,
): string | null {
  const href = normalizeCustomImageUrl(raw);
  return href ? customAvatarKey(href) : null;
}

export function parseAvatarKey(raw: string | null | undefined): ParsedAvatar {
  const value = (raw ?? "brendan").trim() || "brendan";
  const lower = value.toLowerCase();

  if (lower.startsWith(CUSTOM_AVATAR_PREFIX)) {
    const href = normalizeCustomImageUrl(value);
    if (href) return { kind: "custom", url: href };
    return { kind: "trainer", key: "brendan" };
  }

  if (lower.startsWith(POKEMON_ANI_AVATAR_PREFIX)) {
    return parsePokemonAvatarRest(
      "pokemon-ani",
      value.slice(POKEMON_ANI_AVATAR_PREFIX.length).trim(),
    );
  }

  if (lower.startsWith(POKEMON_AVATAR_PREFIX)) {
    return parsePokemonAvatarRest(
      "pokemon",
      value.slice(POKEMON_AVATAR_PREFIX.length).trim(),
    );
  }

  return { kind: "trainer", key: trainerAvatarKey(value) };
}

function parsePokemonAvatarRest(
  kind: "pokemon" | "pokemon-ani",
  rest: string,
): ParsedAvatar {
  const asId = Number(rest);
  if (Number.isFinite(asId) && asId > 0) {
    return { kind, pokedexId: asId, species: rest };
  }
  return { kind, pokedexId: null, species: rest || "Pikachu" };
}

/**
 * Public HTTPS image URLs we accept for custom avatars / textures.
 * Includes Vercel Blob uploads and user-pasted hotlinks. We never fetch these
 * server-side — they are rendered client-side with `unoptimized` / CSS url().
 */
export function isAllowedCustomAvatarUrl(url: string): boolean {
  if (!url || url.length > CUSTOM_IMAGE_URL_MAX_LENGTH) return false;
  if (UNSAFE_CUSTOM_URL_CHARS.test(url)) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (!parsed.hostname) return false;
    if (parsed.username || parsed.password) return false;
    if (isBlockedCustomImageHost(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

/** True when the URL is one of our Vercel Blob public objects. */
export function isVercelBlobCustomUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return parsed.hostname
      .toLowerCase()
      .endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/** True when the blob path was uploaded under this user's avatar folder. */
export function isOwnedCustomAvatarUrl(url: string, userId: string): boolean {
  if (!userId || !isVercelBlobCustomUrl(url)) return false;
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    const marker = `/avatars/${userId}/`;
    return path.includes(marker) || path.startsWith(marker.slice(1));
  } catch {
    return false;
  }
}

/**
 * Whether the acting user may persist this custom avatar URL.
 * Hotlinked HTTPS URLs are allowed; Blob URLs must be owned (or already saved).
 */
export function canUseCustomAvatarUrl(
  url: string,
  actingUserId: string,
  alreadySaved: boolean,
): boolean {
  if (alreadySaved) return true;
  if (!isAllowedCustomAvatarUrl(url)) return false;
  if (!isVercelBlobCustomUrl(url)) return true;
  return isOwnedCustomAvatarUrl(url, actingUserId);
}

/** Resolve board/card avatar URL for trainer, Pokémon, or custom uploads. */
export function avatarImageUrl(raw: string | null | undefined): string {
  const parsed = parseAvatarKey(raw);
  if (parsed.kind === "custom") return parsed.url;
  if (parsed.kind === "pokemon-ani") {
    return pokemonAnimatedSpriteUrl(pokemonAniSpecies(parsed));
  }
  if (parsed.kind === "pokemon") {
    return pokemonSpriteUrl(parsed.species, { pokedexId: parsed.pokedexId });
  }
  return trainerSpriteUrl(parsed.key);
}

/**
 * Static stand-in for an animated avatar (reduced-motion and GIF load failure).
 * Returns null when the key isn't an animated Pokémon portrait.
 */
export function avatarStillImageUrl(
  raw: string | null | undefined,
): string | null {
  const parsed = parseAvatarKey(raw);
  if (parsed.kind !== "pokemon-ani") return null;
  return pokemonSpriteUrl(pokemonAniSpecies(parsed), {
    pokedexId: parsed.pokedexId,
  });
}

function pokemonAniSpecies(parsed: {
  pokedexId: number | null;
  species: string;
}): string {
  if (parsed.pokedexId && parsed.pokedexId > 0) {
    const entry = findPokemonById(parsed.pokedexId);
    if (entry) return entry.slug;
  }
  return parsed.species;
}

/**
 * Tailwind classes for avatar images — custom uploads and ani GIFs aren't
 * pixel art. Everything is `object-contain`: hotlinked and GIF avatars skip
 * the square canvas in `prepareAvatarFile`, and cropping them hides part of
 * the picked image rather than matching what the picker showed.
 */
export function avatarImageClassName(
  raw: string | null | undefined,
  sizeClass: string,
): string {
  const kind = parseAvatarKey(raw).kind;
  if (kind === "custom" || kind === "pokemon-ani") {
    return `${sizeClass} rounded-lg object-contain`;
  }
  return `pixelated ${sizeClass} object-contain`;
}
