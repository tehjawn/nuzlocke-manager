/**
 * First-run / progressive onboarding helpers (issue #183).
 *
 * Phase 1: narrow season chrome for signed-in players who have not finished
 * the welcome path and have not imported any party Pokémon yet. Existing
 * players (welcome read, or any party mon) and GMs keep full chrome.
 */

/**
 * Local preview only — leave `false` in committed code. When `true`, signed-in
 * sessions get first-run chrome even with welcome read / party / GM.
 */
export const FORCE_FIRST_RUN_CHROME = false;

export type FirstRunInput = {
  signedIn: boolean;
  /** Welcome notification has been marked read (tour skipped or setup done). */
  welcomeCompleted: boolean;
  /** Own trainer has at least one MAIN-party Pokémon (shell payload). */
  hasProgress: boolean;
  /** GMs always see full chrome + GM tools. */
  isGm?: boolean;
};

/**
 * Whether season workspace chrome should be backloaded (hide SeasonTabs rail,
 * pack feed, and dense header/Jump destinations).
 */
export function isFirstRunChrome(input: FirstRunInput): boolean {
  // Preview mode: any signed-in session looks like day-one.
  if (FORCE_FIRST_RUN_CHROME && input.signedIn) return true;
  if (input.isGm) return false;
  // Spectators keep full chrome so browsing the league stays usable.
  if (!input.signedIn) return false;
  if (input.welcomeCompleted) return false;
  if (input.hasProgress) return false;
  return true;
}