import assert from "node:assert/strict";
import test from "node:test";
import {
  feedbackNotificationHref,
  feedbackReviewActionKey,
  feedbackStatusActionKey,
} from "@/lib/feedback-types";
import { submitFeedbackSchema } from "@/lib/feedback-validation";

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
  assert.equal(feedbackNotificationHref("feedback-review:../admin:one"), null);
  assert.equal(feedbackNotificationHref("welcome"), null);
});
