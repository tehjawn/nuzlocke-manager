/** Curated TrainerCard background presets (league board chrome). */

export const CARD_BACKGROUND_KEYS = [
  "littleroot",
  "petalburg-dusk",
  "dewford-harbor",
  "victory-road",
  "elite-four",
] as const;

export type CardBackgroundKey = (typeof CARD_BACKGROUND_KEYS)[number];

export type CardBackgroundOption = {
  key: CardBackgroundKey;
  label: string;
};

/** Catalog is the single source of truth for UI + server validation. */
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
 * `null` / empty / unknown → `null` (default card chrome).
 */
export function parseCardBackgroundKey(
  value: string | null | undefined,
): CardBackgroundKey | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return isCardBackgroundKey(trimmed) ? trimmed : null;
}

/** Reject tampered keys; allow explicit null (reset to default). */
export function assertCardBackgroundKey(
  value: string | null,
): CardBackgroundKey | null {
  if (value == null) return null;
  if (!isCardBackgroundKey(value)) {
    throw new Error("Pick a card background from the list");
  }
  return value;
}
