/**
 * Training / bond quality — orthogonal to catch tier (IV luck).
 *
 * Ladder: raw → growing → trained → bonded.
 * Colors climb the same good → great → cracked tint family as catch chrome;
 * vocabulary stays care-shaped (not big-oof→god).
 *
 * Thresholds are tuned for **organic Nuzlocke EV gain** (spread across stats
 * while grinding to a level cap), not Smogon 252/252 spreads. Trash Pack
 * Emerald cap is 63 at Champion — those mains typically sit near the 510 EV
 * pool with no single 252.
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

/** Fill fraction for the bond heart glyph (raw = empty outline). */
const TRAINING_TIER_FILL: Record<TrainingTier, number> = {
  raw: 0,
  growing: 0.4,
  trained: 0.85,
  bonded: 1,
};

const TRAINING_TIER_LABEL: Record<TrainingTier, string | null> = {
  raw: "Strangers",
  growing: "Acquaintances",
  trained: "Friends",
  bonded: "Best friends",
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

/**
 * Grade training / bond from EVs + nature fit + optional friendship.
 *
 * With friendship on file: gold/`bonded` needs trained + friendship ≥
 * {@link BONDED_FRIENDSHIP_MIN}.
 *
 * Without friendship (pre-reimport rows): gold when the EV pool is nearly
 * capped ({@link BONDED_EV_TOTAL}+) — the organic endgame signal — or when
 * nature helps and EVs look competitively cracked.
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
  const total = evTotal(evs);
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

  const friendship = input.friendship;
  if (friendship != null) {
    return friendship >= BONDED_FRIENDSHIP_MIN ? "bonded" : "trained";
  }

  // No friendship column yet — near-max organic pool stands in for endgame care.
  if (total >= BONDED_EV_TOTAL || (natureHelps && cracked)) return "bonded";
  return "trained";
}
