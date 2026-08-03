"use client";

import { useTransition } from "react";
import { submitFeedbackAction } from "@/app/actions/feedback";
import { pushSnackbar } from "@/components/Snackbar";
import { displayActionError } from "@/lib/action-error-display";
import {
  FEEDBACK_CATEGORIES,
  feedbackCategoryLabel,
} from "@/lib/feedback-types";

export function FeedbackForm({ challengeId }: { challengeId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        startTransition(async () => {
          try {
            const result = await submitFeedbackAction({
              category: String(data.get("category")),
              challengeId,
              message: String(data.get("message") ?? ""),
              subject: String(data.get("subject") ?? ""),
            });
            if (!result.ok) {
              pushSnackbar(displayActionError(result.error), "error");
              return;
            }
            form.reset();
            pushSnackbar(result.message);
          } catch (error) {
            pushSnackbar(
              displayActionError(
                error instanceof Error ? error.message : "Could not send feedback",
              ),
              "error",
            );
          }
        });
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-bold text-muted">What do you need?</span>
        <select
          className="w-full rounded-lg border border-frame bg-surface px-3 py-2.5"
          data-testid="feedback-category"
          defaultValue="BUG"
          disabled={pending}
          name="category"
          required
        >
          {FEEDBACK_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {feedbackCategoryLabel(category)}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-bold text-muted">Short summary</span>
        <input
          className="w-full rounded-lg border border-frame bg-surface px-3 py-2.5"
          data-testid="feedback-subject"
          disabled={pending}
          maxLength={100}
          minLength={3}
          name="subject"
          placeholder="What happened or what would help?"
          required
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-bold text-muted">Details</span>
        <textarea
          className="min-h-36 w-full rounded-lg border border-frame bg-surface px-3 py-2.5"
          data-testid="feedback-details"
          disabled={pending}
          maxLength={2_000}
          minLength={10}
          name="message"
          placeholder="For bugs, include what you were doing, what you expected, and what happened."
          required
        />
        <span className="mt-1 block text-xs leading-relaxed text-muted">
          Please do not include passwords, invite codes, or other private
          information.
        </span>
      </label>

      <button
        className="pressable inline-flex min-h-10 items-center bg-accent px-4 py-2 text-sm font-semibold text-[var(--on-accent)] disabled:cursor-wait disabled:opacity-60"
        data-testid="feedback-submit"
        disabled={pending}
        type="submit"
      >
        {pending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
