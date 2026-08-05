export type TrainerBoardActionKey =
  | "copy"
  | "endRun"
  | "export"
  | "history"
  | "import"
  | "reset"
  | "revive";

export const TRAINER_BOARD_ACTION_ORDER: readonly TrainerBoardActionKey[] = [
  "revive",
  "import",
  "export",
  "copy",
  "history",
  "endRun",
  "reset",
];
