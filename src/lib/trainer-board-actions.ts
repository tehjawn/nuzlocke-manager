export type TrainerBoardActionKey =
  | "copy"
  | "export"
  | "history"
  | "import"
  | "reset"
  | "revive"
  | "wipe";

export const TRAINER_BOARD_ACTION_ORDER: readonly TrainerBoardActionKey[] = [
  "revive",
  "import",
  "export",
  "copy",
  "history",
  "wipe",
  "reset",
];
