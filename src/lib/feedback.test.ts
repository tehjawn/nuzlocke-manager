import assert from "node:assert/strict";
import test from "node:test";
import {
  feedbackNoteActionKey,
  feedbackNotificationHref,
  feedbackReviewActionKey,
  feedbackStatusActionKey,
} from "@/lib/feedback-types";
import {
  submitFeedbackSchema,
  updateFeedbackStatusSchema,
} from "@/lib/feedback-validation";

test("validates and trims structured feedback", () => {
  const result = submitFeedbackSchema.parse({
    category: "BUG",
    challengeId: "challenge-1",
    message: "  The save import misses my boxed Pokémon.  ",
    subject: "  Save import issue  ",
  });

  assert.deepEqual(result, {
    category: "BUG",
    challengeId: "challenge-1",
    message: "The save import misses my boxed Pokémon.",
    subject: "Save import issue",
  });
});

test("rejects feedback without useful detail", () => {
  const result = submitFeedbackSchema.safeParse({
    category: "SUPPORT",
    challengeId: "challenge-1",
    message: "help",
    subject: "Hi",
  });

  assert.equal(result.success, false);
});

test("maps GM and player feedback notifications to safe destinations", () => {
  assert.equal(
    feedbackNotificationHref(feedbackReviewActionKey("trash-pack-2026", "one")),
    "/challenges/trash-pack-2026/gm?tab=feedback",
  );
  assert.equal(
    feedbackNotificationHref(
      feedbackStatusActionKey("trash-pack-2026", "one", "RESOLVED"),
    ),
    "/challenges/trash-pack-2026/feedback",
  );
  assert.equal(
    feedbackNotificationHref(feedbackNoteActionKey("trash-pack-2026", "one")),
    "/challenges/trash-pack-2026/feedback",
  );
  assert.equal(feedbackNotificationHref("feedback-review:../admin:one"), null);
  assert.equal(feedbackNotificationHref("welcome"), null);
});

test("accepts a shared GM note on status update", () => {
  const result = updateFeedbackStatusSchema.parse({
    challengeId: "challenge-1",
    gmNote: "  Thanks — fixed in https://github.com/org/repo/pull/1  ",
    status: "RESOLVED",
    submissionId: "submission-1",
  });

  assert.equal(
    result.gmNote,
    "  Thanks — fixed in https://github.com/org/repo/pull/1  ",
  );
  assert.equal(result.status, "RESOLVED");
});

test("rejects oversized GM notes", () => {
  const result = updateFeedbackStatusSchema.safeParse({
    challengeId: "challenge-1",
    gmNote: "x".repeat(2001),
    status: "IN_REVIEW",
    submissionId: "submission-1",
  });
  assert.equal(result.success, false);
});
