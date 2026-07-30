/**
 * Per-badge earn SFX paths (Emerald / Hoenn keys).
 * Unknown keys fall back to the generic badge sting.
 */

import { SFX_SRC } from "@/features/fx/fx-events";

/** Themed one-shots under `public/sfx/badges/`. */
export const BADGE_SFX_SRC: Record<string, string> = {
  "gym-1": "/sfx/badges/gym-1.wav", // Stone — rock
  "gym-2": "/sfx/badges/gym-2.wav", // Knuckle — fighting
  "gym-3": "/sfx/badges/gym-3.wav", // Dynamo — electric
  "gym-4": "/sfx/badges/gym-4.wav", // Heat — fire
  "gym-5": "/sfx/badges/gym-5.wav", // Balance — normal
  "gym-6": "/sfx/badges/gym-6.wav", // Feather — flying
  "gym-7": "/sfx/badges/gym-7.wav", // Mind — psychic
  "gym-8": "/sfx/badges/gym-8.wav", // Rain — water
  "elite-1": "/sfx/badges/elite-1.wav", // Sidney — dark
  "elite-2": "/sfx/badges/elite-2.wav", // Phoebe — ghost
  "elite-3": "/sfx/badges/elite-3.wav", // Glacia — ice
  "elite-4": "/sfx/badges/elite-4.wav", // Drake — dragon
  championship: "/sfx/badges/championship.wav",
};

export function resolveBadgeSfxSrc(badgeKey: string | undefined): string {
  if (!badgeKey || !Object.hasOwn(BADGE_SFX_SRC, badgeKey)) {
    return SFX_SRC.badge;
  }
  return BADGE_SFX_SRC[badgeKey];
}
