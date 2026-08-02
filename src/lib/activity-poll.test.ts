import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVITY_FORCE_REFRESH_AFTER_UNCHANGED_POLLS,
  activityPollHead,
} from "@/lib/activity-poll";

test("keeps using the watermark before the verification interval", () => {
  assert.equal(
    activityPollHead(
      "activity-head",
      ACTIVITY_FORCE_REFRESH_AFTER_UNCHANGED_POLLS - 1,
    ),
    "activity-head",
  );
});

test("forces a DB verification after repeated unchanged polls", () => {
  assert.equal(
    activityPollHead(
      "activity-head",
      ACTIVITY_FORCE_REFRESH_AFTER_UNCHANGED_POLLS,
    ),
    null,
  );
});
