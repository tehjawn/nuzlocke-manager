/** Curated + custom TrainerCard background presets (league board chrome). */

import {
  customTextureKey,
  parseCustomTextureUrl,
} from "@/lib/custom-texture";

export const CARD_BACKGROUND_KEYS = [
  "littleroot",
  "petalburg-dusk",
  "dewford-harbor",
  "victory-road",
  "elite-four",
] as const;

export type CardBackgroundKey = (typeof CARD_BACKGROUND_KEYS)[number];

/** Curated key, `custom:https://…`, or null (default chrome). */
export type CardBackgroundValue = CardBackgroundKey | string | null;

export type CardBackgroundOption = {
  key: CardBackgroundKey;
  label: string;
};

/** Catalog is the single source of truth for curated UI + validation. */
export const CARD_BACKGROUNDS: readonly CardBackgroundOption[] = [
  { key: "littleroot", label: "Littleroot" },
  { key: "petalburg-dusk", label: "Petalburg Dusk" },
  { key: "dewford-harbor", label: "Dewford Harbor" },
  { key: "victory-road", label: "Victory Road" },
  { key: "elite-four", label: "Elite Four" },
] as const;

const KEY_SET = new Set<string>(CARD_BACKGROUND_KEYS);

export function isCardBackgroundKey(
  value: unknown,
): value is CardBackgroundKey {
  return typeof value === "string" && KEY_SET.has(value);
}

/**
 * Normalize a stored / submitted value.
 * Curated key or canonical custom URL key → itself; empty / unknown → `null`.
 */
export function parseCardBackgroundKey(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isCardBackgroundKey(trimmed)) return trimmed;
  const customUrl = parseCustomTextureUrl(trimmed);
  if (customUrl) return customTextureKey(customUrl);
  return null;
}

/** Blob URL for a custom card chrome image, else null. */
export function cardBackgroundCustomUrl(
  value: string | null | undefined,
): string | null {
  return parseCustomTextureUrl(value);
}

/** `data-card-bg` token: curated key, `custom`, or omit. */
export function cardBackgroundDataAttr(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  if (isCardBackgroundKey(value)) return value;
  if (parseCustomTextureUrl(value)) return "custom";
  return undefined;
}
