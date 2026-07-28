import type { AccessContext } from "@/lib/permissions";

const COOKIE_PREFIX = "nuzlocke-gm-lens.";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // ~6 months

export function gmLensCookieName(slug: string): string {
  return `${COOKIE_PREFIX}${slug}`;
}

/** Client: read lens flag from document.cookie. */
export function readGmLensOnClient(slug: string): boolean {
  if (typeof document === "undefined") return false;
  const name = gmLensCookieName(slug);
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match?.split("=")[1] === "1";
}

/** Client: persist lens flag (readable by RSC on next refresh). */
export function writeGmLensOnClient(slug: string, on: boolean): void {
  const name = gmLensCookieName(slug);
  if (on) {
    document.cookie = `${name}=1; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
  } else {
    document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
  }
}

/**
 * Competitive nature/ability/stats/moves visibility.
 * Owners always see their own; GMs only when GM lens is on.
 */
export function canViewCompetitiveDetails(
  access: AccessContext | null | undefined,
  trainerUserId: string | null,
  gmLensOn: boolean,
): boolean {
  if (!access) return false;
  if (access.ownsTrainer(trainerUserId)) return true;
  return access.isGm && gmLensOn;
}

/**
 * Edit access for a trainer board.
 * Players: own board only (via canEditTrainer).
 * GMs: own board always; others only with GM lens on.
 */
export function canEditTrainerBoard(
  access: AccessContext | null | undefined,
  trainerUserId: string | null,
  gmLensOn: boolean,
  seasonReadOnly: boolean,
): boolean {
  if (!access || seasonReadOnly) return false;
  if (!access.canEditTrainer(trainerUserId)) return false;
  if (access.ownsTrainer(trainerUserId)) return true;
  return access.isGm && gmLensOn;
}
