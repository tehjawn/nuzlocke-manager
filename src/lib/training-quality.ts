/**
 * Training / bond quality — orthogonal to catch tier (IV luck).
 *
 * Ladder: raw → growing → trained → bonded.
 * Colors climb the same good → great → cracked tint family as catch chrome;
 * vocabulary stays care-shaped (not shit→god).
 */

import {
  classifyEv,
  summarizeEvs,
} from "@/lib/iv-quality";
import type { NatureAlignment } from "@/lib/playstyle";
import { isEmptySpread, STAT_KEYS, type StatSpread } from "@/lib/stats";

/** Worst → best; array order doubles as the tier ladder. */
export const TRAINING_TIERS = [
  "raw",
  "growing",
  "trained",
  "bonded",
] as const;

export type TrainingTier = (typeof TRAINING_TIERS)[number];

/**
 * Gen 3 friendship evolution threshold — also the bonded bar once friendship
 * is on the specimen. Documented once so chrome and import stay in sync.
 */
export const BONDED_FRIENDSHIP_MIN = 220;

/** Total EV pool that counts as early investment (growing). */
const GROWING_EV_TOTAL = 100;

/** Fill fraction for the bond heart glyph (raw has no heart). */
const TRAINING_TIER_FILL: Record<TrainingTier, number> = {
  raw: 0,
  growing: 0.4,
  trained: 0.85,
  bonded: 1,
};

const TRAINING_TIER_LABEL: Record<TrainingTier, string | null> = {
  raw: null,
  growing: "Growing",
  trained: "Trained",
  bonded: "Bonded",
};

export function trainingTierRank(tier: TrainingTier): number {
  return TRAINING_TIERS.indexOf(tier);
}

/** Beginner-facing label; null when the heart should stay silent. */
export function trainingTierLabel(tier: TrainingTier): string | null {
  return TRAINING_TIER_LABEL[tier];
}

/** Heart fill 0–1 for CSS `--bond-fill`. */
export function trainingTierFill(tier: TrainingTier): number {
  return TRAINING_TIER_FILL[tier];
}

/** True when a bond heart should render (any investment on file). */
export function trainingTierHasHeart(tier: TrainingTier): boolean {
  return tier !== "raw";
}

/** Label tone class — mirrors catch-label brightness via bond modifiers. */
export function trainingTierToneClass(tier: TrainingTier): string {
  return `pokemon-bond-label--${tier}`;
}

function evTotal(evs: StatSpread): number {
  return STAT_KEYS.reduce((sum, key) => sum + (evs[key] ?? 0), 0);
}

function hasStrongEv(evs: StatSpread): boolean {
  return STAT_KEYS.some((key) => classifyEv(evs[key] ?? 0) !== "average");
}

/**
 * Grade training / bond from EVs + nature fit + optional friendship.
 *
 * Phase 1 (no friendship on file): `bonded` only when trained, nature helps
 * the playstyle, and EVs are cracked — a temporary stand-in so gold stays rare.
 * Phase 1.5: with friendship present, gold requires friendship ≥
 * {@link BONDED_FRIENDSHIP_MIN} (Gen 3 evolution bar); the stand-in does not apply.
 */
export function specimenTrainingTier(input: {
  evs?: StatSpread | null;
  natureAlignment?: NatureAlignment | null;
  friendship?: number | null;
}): TrainingTier {
  const evs = isEmptySpread(input.evs) ? null : input.evs;
  if (!evs) return "raw";

  const summary = summarizeEvs(evs);
  const cracked = summary?.cracked ?? false;
  const perfectCount = summary?.perfect.length ?? 0;
  const natureHelps = input.natureAlignment === "helps";
  const solid =
    cracked || perfectCount >= 1 || hasStrongEv(evs) || evTotal(evs) >= GROWING_EV_TOTAL;

  let tier: TrainingTier = "raw";
  if (cracked || perfectCount >= 2 || (natureHelps && solid)) {
    tier = "trained";
  } else if (hasStrongEv(evs) || evTotal(evs) >= GROWING_EV_TOTAL) {
    tier = "growing";
  } else {
    return "raw";
  }

  if (tier !== "trained") return tier;

  const friendship = input.friendship;
  if (friendship != null) {
    return friendship >= BONDED_FRIENDSHIP_MIN ? "bonded" : "trained";
  }

  // Temporary stand-in until every specimen has friendship from import.
  if (natureHelps && cracked) return "bonded";
  return "trained";
}
