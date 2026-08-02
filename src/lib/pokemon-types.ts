export const POKEMON_TYPES = [
  "Normal",
  "Fighting",
  "Flying",
  "Poison",
  "Ground",
  "Rock",
  "Bug",
  "Ghost",
  "Steel",
  "Fire",
  "Water",
  "Grass",
  "Electric",
  "Psychic",
  "Ice",
  "Dragon",
  "Dark",
  "Fairy",
] as const;

export type PokemonType = (typeof POKEMON_TYPES)[number];

/** Approximate Gen 3–friendly type chip colors */
export const TYPE_COLORS: Record<PokemonType, string> = {
  Normal: "#a8a878",
  Fighting: "#c03028",
  Flying: "#a890f0",
  Poison: "#a040a0",
  Ground: "#e0c068",
  Rock: "#b8a038",
  Bug: "#a8b820",
  Ghost: "#705898",
  Steel: "#b8b8d0",
  Fire: "#f08030",
  Water: "#6890f0",
  Grass: "#78c850",
  Electric: "#f8d030",
  Psychic: "#f85888",
  Ice: "#98d8d8",
  Dragon: "#7038f8",
  Dark: "#705848",
  Fairy: "#ee99ac",
};

const NEAR_BLACK = "#111827";
const WHITE = "#ffffff";

function parseHexRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function srgbChannelToLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance for a hex color (`#rgb` / `#rrggbb`). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHexRgb(hex);
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Near-black or white ink — whichever contrasts better against `bgHex`.
 * Fixes unreadable white-on-Electric / Ground / Ice type chips.
 */
export function contrastInkForHex(bgHex: string): typeof NEAR_BLACK | typeof WHITE {
  const bg = relativeLuminance(bgHex);
  const vsWhite = contrastRatio(bg, relativeLuminance(WHITE));
  const vsBlack = contrastRatio(bg, relativeLuminance(NEAR_BLACK));
  return vsBlack >= vsWhite ? NEAR_BLACK : WHITE;
}

/** Text color for a type chip filled with {@link TYPE_COLORS}. */
export function typeBadgeInk(type: PokemonType): typeof NEAR_BLACK | typeof WHITE {
  return contrastInkForHex(TYPE_COLORS[type]);
}
