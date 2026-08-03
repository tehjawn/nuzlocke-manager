import assert from "node:assert/strict";
import test from "node:test";
import { TRAINER_BOARD_ACTION_ORDER } from "./trainer-board-actions";

test("orders trainer board actions consistently", () => {
  assert.deepEqual(TRAINER_BOARD_ACTION_ORDER, [
    "revive",
    "import",
    "export",
    "copy",
    "history",
    "wipe",
    "reset",
  ]);
});
