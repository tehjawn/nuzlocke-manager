/**
 * Pokémon Showdown sprite path helpers.
 *
 * Browsers load sprites from our same-origin `/api/sprites/…` proxy so
 * intermittent Cloudflare 403s on play.pokemonshowdown.com never hit the UI.
 * Upstream fetches + caching live in the route handler.
 */

export const SHOWDOWN_ORIGIN = "https://play.pokemonshowdown.com";

/** Public browse indexes (open in a new tab — not proxied). */
export const SHOWDOWN_TRAINER_SPRITES_DIR =
  `${SHOWDOWN_ORIGIN}/sprites/trainers/?sort=name&view=dir`;
export const SHOWDOWN_POKEMON_SPRITES_DIR =
  `${SHOWDOWN_ORIGIN}/sprites/gen5/?sort=name&view=dir`;
export const SHOWDOWN_ANI_SPRITES_DIR =
  `${SHOWDOWN_ORIGIN}/sprites/ani/?sort=name&view=dir`;

/** Folders we are willing to proxy from Showdown. */
export const SHOWDOWN_SPRITE_FOLDERS = [
  "trainers",
  "gen5",
  "gen5-shiny",
  "ani",
  "ani-shiny",
  "itemicons",
] as const;

export type ShowdownSpriteFolder = (typeof SHOWDOWN_SPRITE_FOLDERS)[number];

const FOLDER_SET = new Set<string>(SHOWDOWN_SPRITE_FOLDERS);

/** File stem: Showdown keys are lowercase alphanumerics with `-` / `_` / `.`. */
const SPRITE_STEM = /^[a-z0-9][a-z0-9._-]*$/i;
const SPRITE_EXT = /^(png|gif)$/i;

export type ParsedShowdownSpritePath = {
  folder: ShowdownSpriteFolder;
  file: string;
  upstreamUrl: string;
};

/**
 * Validate a catch-all route path (`["trainers","red.png"]`) and resolve the
 * upstream Showdown URL. Returns null when the path is not an allowed sprite.
 */
export function parseShowdownSpritePath(
  segments: string[],
): ParsedShowdownSpritePath | null {
  if (segments.length !== 2) return null;
  const [folderRaw, fileRaw] = segments;
  if (!folderRaw || !fileRaw) return null;
  if (!FOLDER_SET.has(folderRaw)) return null;

  const dot = fileRaw.lastIndexOf(".");
  if (dot <= 0) return null;
  const stem = fileRaw.slice(0, dot);
  const ext = fileRaw.slice(dot + 1);
  if (!SPRITE_STEM.test(stem) || !SPRITE_EXT.test(ext)) return null;

  // Animated folders are GIFs; everything else we use is PNG.
  const folder = folderRaw as ShowdownSpriteFolder;
  if (
    (folder === "ani" || folder === "ani-shiny") &&
    ext.toLowerCase() !== "gif"
  ) {
    return null;
  }
  if (
    folder !== "ani" &&
    folder !== "ani-shiny" &&
    ext.toLowerCase() !== "png"
  ) {
    return null;
  }

  const file = `${stem}.${ext.toLowerCase()}`;
  return {
    folder,
    file,
    upstreamUrl: `${SHOWDOWN_ORIGIN}/sprites/${folder}/${file}`,
  };
}

/** Same-origin URL for an allowed Showdown sprite. */
export function showdownProxyUrl(
  folder: ShowdownSpriteFolder,
  file: string,
): string {
  const parsed = parseShowdownSpritePath([folder, file]);
  if (!parsed) {
    throw new Error(`Invalid Showdown sprite path: ${folder}/${file}`);
  }
  return `/api/sprites/${parsed.folder}/${parsed.file}`;
}
