export type TrainerBoardActionKey =
  | "copy"
  | "endRun"
  | "export"
  | "history"
  | "import"
  | "reset"
  | "revive";

/**
 * High-frequency / CTA verbs that stay in the top strip (and optionally
 * Shortcuts). Import leads — revive status lives on R.I.P.; spend/reset are
 * overflow / import-sync (#325).
 */
export const TRAINER_BOARD_PRIMARY_ACTIONS: readonly TrainerBoardActionKey[] = [
  "import",
];

/**
 * Secondary verbs tucked behind a single More control. Same gates as before —
 * only placement changes (#325).
 */
export const TRAINER_BOARD_OVERFLOW_ACTIONS: readonly TrainerBoardActionKey[] = [
  "export",
  "copy",
  "history",
  "revive",
  "endRun",
  "reset",
];

/** Full catalog order (primary then overflow). Prefer the split lists above. */
export const TRAINER_BOARD_ACTION_ORDER: readonly TrainerBoardActionKey[] = [
  ...TRAINER_BOARD_PRIMARY_ACTIONS,
  ...TRAINER_BOARD_OVERFLOW_ACTIONS,
];
