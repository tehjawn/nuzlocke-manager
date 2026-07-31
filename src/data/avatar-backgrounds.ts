/** Curated + custom avatar backdrop presets (stage plate behind the sprite). */

import {
  customTextureKey,
  parseCustomTextureUrl,
} from "@/lib/custom-texture";

export const AVATAR_BACKGROUND_KEYS = [
  "spotlight",
  "ember",
  "tide",
  "meadow",
  "rocky",
  "spark",
] as const;

export type AvatarBackgroundKey = (typeof AVATAR_BACKGROUND_KEYS)[number];

/** Curated key, `custom:https://…`, or null (no stage). */
export type AvatarBackgroundValue = AvatarBackgroundKey | string | null;

export type AvatarBackgroundOption = {
  key: AvatarBackgroundKey;
  label: string;
};

/** Catalog is the single source of truth for curated UI + validation. */
export const AVATAR_BACKGROUNDS: readonly AvatarBackgroundOption[] = [
  { key: "spotlight", label: "Spotlight" },
  { key: "ember", label: "Ember" },
  { key: "tide", label: "Tide" },
  { key: "meadow", label: "Meadow" },
  { key: "rocky", label: "Rocky" },
  { key: "spark", label: "Spark" },
] as const;

const KEY_SET = new Set<string>(AVATAR_BACKGROUND_KEYS);

export function isAvatarBackgroundKey(
  value: unknown,
): value is AvatarBackgroundKey {
  return typeof value === "string" && KEY_SET.has(value);
}

/**
 * Normalize a stored / submitted value.
 * Curated key or canonical custom URL key → itself; empty / unknown → `null`.
 */
export function parseAvatarBackgroundKey(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isAvatarBackgroundKey(trimmed)) return trimmed;
  const customUrl = parseCustomTextureUrl(trimmed);
  if (customUrl) return customTextureKey(customUrl);
  return null;
}

/** HTTPS URL for a custom backdrop, else null. */
export function avatarBackgroundCustomUrl(
  value: string | null | undefined,
): string | null {
  return parseCustomTextureUrl(value);
}

/** `data-avatar-bg` token: curated key, `custom`, or omit. */
export function avatarBackgroundDataAttr(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  if (isAvatarBackgroundKey(value)) return value;
  if (parseCustomTextureUrl(value)) return "custom";
  return undefined;
}
