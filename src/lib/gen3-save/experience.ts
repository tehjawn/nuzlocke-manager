/**
 * Gen 3 experience ↔ level (Emerald / pret formulas).
 *
 * Box / Day Care Pokémon store experience only; the game derives level on
 * summary / withdraw. We mirror that so import can fill `level` for battle stats.
 */

import speciesGrowthData from "@/data/species-growth.json";

export const GROWTH_RATES = [
  "erratic",
  "fast",
  "medium-fast",
  "medium-slow",
  "slow",
  "fluctuating",
] as const;

export type GrowthRate = (typeof GROWTH_RATES)[number];

const GROWTH_BY_DEX = speciesGrowthData.growth as Record<string, string>;

export function growthRateForPokedexId(
  pokedexId: number | null | undefined,
): GrowthRate | null {
  if (pokedexId == null || pokedexId <= 0) return null;
  const rate = GROWTH_BY_DEX[String(pokedexId)];
  if (!rate) return null;
  return GROWTH_RATES.includes(rate as GrowthRate)
    ? (rate as GrowthRate)
    : null;
}

/** Experience required to *reach* `level` (1–100). Level 1 is always 0. */
export function experienceForLevel(level: number, rate: GrowthRate): number {
  const n = Math.max(1, Math.min(100, Math.floor(level)));
  if (n === 1) return 0;
  const n3 = n * n * n;

  switch (rate) {
    case "medium-fast":
      return n3;
    case "fast":
      return Math.floor((4 * n3) / 5);
    case "slow":
      return Math.floor((5 * n3) / 4);
    case "medium-slow":
      return Math.floor((6 * n3) / 5 - 15 * n * n + 100 * n - 140);
    case "erratic":
      if (n < 50) return Math.floor((n3 * (100 - n)) / 50);
      if (n < 68) return Math.floor((n3 * (150 - n)) / 100);
      if (n < 98) {
        return Math.floor((n3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      }
      return Math.floor((n3 * (160 - n)) / 100);
    case "fluctuating":
      if (n < 15) {
        return Math.floor((n3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      }
      if (n <= 36) return Math.floor((n3 * (n + 14)) / 50);
      return Math.floor((n3 * (Math.floor(n / 2) + 32)) / 50);
    default: {
      const _exhaustive: never = rate;
      return _exhaustive;
    }
  }
}

/**
 * Highest level in 1..100 whose exp threshold is ≤ stored experience.
 * Returns null when experience is unusable.
 */
export function levelFromExperience(
  experience: number,
  rate: GrowthRate,
): number | null {
  if (!Number.isFinite(experience) || experience < 0) return null;
  const exp = Math.floor(experience);
  let lo = 1;
  let hi = 100;
  let best = 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const need = experienceForLevel(mid, rate);
    if (need <= exp) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/** Derive level from exp + National Dex growth table; null on soft-fail. */
export function levelFromExperienceForSpecies(
  experience: number,
  pokedexId: number | null | undefined,
): number | null {
  const rate = growthRateForPokedexId(pokedexId);
  if (!rate) return null;
  return levelFromExperience(experience, rate);
}
