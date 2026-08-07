export type TrainerBoardActionKey =
  "copy" | "endRun" | "export" | "history" | "import" | "reset" | "revive";

/**
 * High-frequency / CTA verbs that stay in the top strip (and optionally
 * Shortcuts). Import leads — revive status lives on R.I.P.; spend/reset are
 * overflow / import-sync (#325).
 *
 * `endRun` renders a toolbar slot only once the Championship is earned and the
 * run is still open — the one moment it is the obvious next action, where it
 * reads "Mark run completed". Every other time its toolbar slot is null and it
 * stays in More as "End run" / "Start new run", so listing it here costs
 * nothing.
 */
export const TRAINER_BOARD_PRIMARY_ACTIONS: readonly TrainerBoardActionKey[] = [
  "import",
  "endRun",
];

/**
 * Secondary verbs tucked behind a single More control. Same gates as before —
 * only placement changes (#325).
 */
export const TRAINER_BOARD_OVERFLOW_ACTIONS: readonly TrainerBoardActionKey[] =
  ["export", "copy", "history", "revive", "endRun", "reset"];
