/**
 * First-run / progressive onboarding helpers (issue #183).
 *
 * Phase 1+: narrow season chrome for signed-in players who have not finished
 * the welcome path and have not imported any party Pokémon yet. Existing
 * players (welcome read, or any party mon) and GMs keep full chrome.
 *
 * First-run still shows About / Rules / Trainers tabs; Tools and Tournament
 * stay hidden until welcome is done.
 * Brand-new players hit /new-trainer before their board.
 *
 * Season CTAs (home Open League, join) use `playerSeasonEntryPath` so create
 * → tour → league stay one funnel instead of dumping mid-intro players on the
 * public board.
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
 * Whether season workspace chrome should be backloaded (hide SeasonTabs rail
 * and dense header/Search destinations).
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

export type SeasonEntryInput = {
  signedIn: boolean;
  isGm?: boolean;
  /**
   * `false` — trainer exists, /new-trainer unfinished.
   * `true` — create moment done.
   * `null` — no trainer yet (provision via /me).
   */
  introCompleted: boolean | null;
  welcomeCompleted: boolean;
  hasProgress: boolean;
};

/**
 * Canonical “enter this season” destination for CTAs (home Open League, join,
 * post-login). Keeps create → tour → league as one funnel:
 *
 * 1. Unfinished /new-trainer → `/new-trainer`
 * 2. Still in first-run (tour / welcome unread, no MAIN) → `/me` (board)
 * 3. Settled players + GMs + spectators → league board
 */
export function playerSeasonEntryPath(
  slug: string,
  input: SeasonEntryInput,
): string {
  const base = `/challenges/${slug}`;
  if (!input.signedIn) return base;
  if (input.isGm) return base;
  if (input.introCompleted === false) return `${base}/new-trainer`;
  if (input.introCompleted === null) return `${base}/me`;
  if (
    isFirstRunChrome({
      signedIn: true,
      welcomeCompleted: input.welcomeCompleted,
      hasProgress: input.hasProgress,
      isGm: false,
    })
  ) {
    return `${base}/me`;
  }
  return base;
}