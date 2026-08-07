/**
 * Training / bond quality — orthogonal to catch tier (IV luck).
 *
 * Ladder: raw → growing → trained → bonded → ultra.
 * Colors climb the same good → great → cracked → god tint family as catch
 * chrome; vocabulary stays care-shaped (not big-oof→god).
 *
 * Thresholds are tuned for **organic Nuzlocke EV gain** (spread across stats
 * while grinding to a level cap), not Smogon 252/252 spreads. Trash Pack
 * Emerald cap is 63 at Champion — those mains typically sit near the 510 EV
 * pool with no single 252.
 */

import { classifyEv, summarizeEvs } from "@/lib/iv-quality";
import type { NatureAlignment } from "@/lib/playstyle";
import { isEmptySpread, STAT_KEYS, type StatSpread } from "@/lib/stats";

/** Worst → best; array order doubles as the tier ladder. */
export const TRAINING_TIERS = [
  "raw",
  "growing",
  "trained",
  "bonded",
  "ultra",
] as const;

export type TrainingTier = (typeof TRAINING_TIERS)[number];

/**
 * Gen 3 friendship evolution threshold — gold/`bonded` once friendship is on
 * the specimen. Documented once so chrome and import stay in sync.
 */
export const BONDED_FRIENDSHIP_MIN = 220;

/** True max friendship — prismatic/`ultra` friendship path. */
export const ULTRA_FRIENDSHIP_MIN = 255;

/** Early grinding — enough to show a faint heart. */
const GROWING_EV_TOTAL = 80;

/**
 * Clear investment — about one fully trained attacking stat's worth of pool,
 * usually reached mid-game under organic gain.
 */
const TRAINED_EV_TOTAL = 252;

/**
 * Near-capped EV pool (max 510). Endgame / level-cap mains land here even
 * when EVs are spread thin — used as the no-friendship bonded stand-in.
 */
const BONDED_EV_TOTAL = 450;

/** True EV pool cap — prismatic/`ultra` training path. */
export const ULTRA_EV_TOTAL = 510;

/** Fill fraction for the bond heart glyph (raw = empty outline). */
const TRAINING_TIER_FILL: Record<TrainingTier, number> = {
  raw: 0,
  growing: 0.4,
  trained: 0.85,
  bonded: 1,
  ultra: 1,
};

const TRAINING_TIER_LABEL: Record<TrainingTier, string | null> = {
  raw: "Strangers",
  growing: "Acquaintances",
  trained: "Friends",
  bonded: "Best friends",
  ultra: "Ultra friends",
};

export function trainingTierRank(tier: TrainingTier): number {
  return TRAINING_TIERS.indexOf(tier);
}

/** Beginner-facing label under the sprite / in tips. */
export function trainingTierLabel(tier: TrainingTier): string | null {
  return TRAINING_TIER_LABEL[tier];
}

/** Hover tip body for the bond heart — casual, no EV/friendship jargon. */
export function trainingTierTip(tier: TrainingTier): string {
  if (tier === "growing") {
    return "Acquaintances: warming up. Bond's forming.";
  }
  if (tier === "trained") {
    return "Friends: main-squad vibes.";
  }
  if (tier === "bonded") {
    return "Best friends: ride or die.";
  }
  if (tier === "ultra") {
    return "Ultra friends: maxed out. Unbreakable.";
  }
  return "Strangers: just met. Still figuring it out.";
}

/** Heart fill 0–1 for CSS `--bond-fill`. */
export function trainingTierFill(tier: TrainingTier): number {
  return TRAINING_TIER_FILL[tier];
}

/** True when a bond heart glyph should render (including the empty raw outline). */
export function trainingTierHasHeart(_tier: TrainingTier): boolean {
  return true;
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

function isUltraBond(input: {
  friendship: number | null | undefined;
  evTotal: number;
}): boolean {
  // Missing-friendship stand-in ladder (mirrors gold at BONDED_EV_TOTAL):
  // only the true EV cap unlocks ultra — no nature/cracked shortcut.
  if (input.friendship == null) {
    return input.evTotal >= ULTRA_EV_TOTAL;
  }
  // Friendship on file: both Best-friends floors, plus a true max on at least
  // one axis (friendship 255 or EV 510). Logged friendship below the gold
  // floor wins over inference — even at EV 510.
  if (
    input.friendship < BONDED_FRIENDSHIP_MIN ||
    input.evTotal < BONDED_EV_TOTAL
  ) {
    return false;
  }
  return (
    input.friendship >= ULTRA_FRIENDSHIP_MIN ||
    input.evTotal >= ULTRA_EV_TOTAL
  );
}

function isBonded(input: {
  friendship: number | null | undefined;
  evTotal: number;
  natureHelps: boolean;
  cracked: boolean;
}): boolean {
  if (
    input.friendship != null &&
    input.friendship >= BONDED_FRIENDSHIP_MIN
  ) {
    return true;
  }
  // No friendship column — near-max organic pool (or nature-helping cracked
  // EVs) stands in for endgame care. Below the gold friendship bar with EVs
  // on file stays trained unless ultra already fired.
  if (input.friendship == null) {
    return input.evTotal >= BONDED_EV_TOTAL || (input.natureHelps && input.cracked);
  }
  return false;
}

/**
 * Grade training / bond from EVs + nature fit + optional friendship.
 *
 * Top of the ladder:
 * - **ultra** (prismatic): both Best-friends floors (friendship ≥
 *   {@link BONDED_FRIENDSHIP_MIN} **and** EV ≥ {@link BONDED_EV_TOTAL}), plus
 *   a true max on at least one axis (friendship ≥ {@link ULTRA_FRIENDSHIP_MIN}
 *   **or** EV ≥ {@link ULTRA_EV_TOTAL}). When friendship is missing, EV ≥
 *   {@link ULTRA_EV_TOTAL} alone stands in (maxed pool ⇒ assume max bond).
 * - **bonded** (gold): friendship ≥ {@link BONDED_FRIENDSHIP_MIN}, or (when
 *   friendship is missing) EV total ≥ {@link BONDED_EV_TOTAL} / nature+cracked
 *
 * Friendship-only rows can reach bonded, but not ultra (no EV floor).
 */
export function specimenTrainingTier(input: {
  evs?: StatSpread | null;
  natureAlignment?: NatureAlignment | null;
  friendship?: number | null;
}): TrainingTier {
  const friendship = input.friendship;
  const evs = isEmptySpread(input.evs) ? null : input.evs;
  const total = evs ? evTotal(evs) : 0;

  if (isUltraBond({ friendship, evTotal: total })) return "ultra";

  if (!evs) {
    if (
      friendship != null &&
      friendship >= BONDED_FRIENDSHIP_MIN
    ) {
      return "bonded";
    }
    return "raw";
  }

  const summary = summarizeEvs(evs);
  const cracked = summary?.cracked ?? false;
  const natureHelps = input.natureAlignment === "helps";
  const strong = hasStrongEv(evs);

  let tier: TrainingTier = "raw";
  if (
    cracked ||
    strong ||
    total >= TRAINED_EV_TOTAL ||
    (natureHelps && total >= GROWING_EV_TOTAL)
  ) {
    tier = "trained";
  } else if (total >= GROWING_EV_TOTAL) {
    tier = "growing";
  } else {
    return "raw";
  }

  if (tier !== "trained") return tier;

  if (
    isBonded({
      friendship,
      evTotal: total,
      natureHelps,
      cracked,
    })
  ) {
    return "bonded";
  }
  return "trained";
}
