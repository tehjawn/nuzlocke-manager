/**
 * High-signal Pack moments for the left-rail Headline Moments carousel (#322).
 * Full feed stays on `/activity`; this allowlist keeps the rail exciting, not noisy.
 */

export const HEADLINE_ACTIVITY_TYPES = [
  "BADGE_EARNED",
  "RUN_COMPLETED",
  "WIPE",
  "RUN_STARTED",
  "MAIN_SQUAD_LOCKED",
] as const;

export type HeadlineActivityType = (typeof HEADLINE_ACTIVITY_TYPES)[number];

/** Max slides in the rail carousel. */
export const HEADLINE_LIMIT = 3;

const HEADLINE_SET = new Set<string>(HEADLINE_ACTIVITY_TYPES);

export function isHeadlineActivityType(
  type: string,
): type is HeadlineActivityType {
  return HEADLINE_SET.has(type);
}
