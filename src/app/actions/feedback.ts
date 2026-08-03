"use server";

import { revalidatePath } from "next/cache";
import { failAction } from "@/lib/action-error";
import {
  createFeedbackSubmission,
  updateFeedbackStatus,
} from "@/lib/feedback";
import {
  submitFeedbackSchema,
  updateFeedbackStatusSchema,
} from "@/lib/feedback-validation";

export type FeedbackActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string; code?: string };

export async function submitFeedbackAction(
  rawInput: unknown,
): Promise<FeedbackActionResult> {
  try {
    const input = submitFeedbackSchema.parse(rawInput);
    const submission = await createFeedbackSubmission(input);
    revalidatePath(`/challenges/${submission.slug}/feedback`);
    return { ok: true, message: "Feedback sent to the GMs" };
  } catch (error) {
    return failAction(
      "submit-feedback",
      error,
      "Could not send feedback — please try again.",
    );
  }
}

export async function updateFeedbackStatusAction(
  rawInput: unknown,
): Promise<FeedbackActionResult> {
  try {
    const input = updateFeedbackStatusSchema.parse(rawInput);
    const result = await updateFeedbackStatus(input);
    revalidatePath(`/challenges/${result.slug}/gm`);
    revalidatePath(`/challenges/${result.slug}/feedback`);
    return {
      ok: true,
      message: result.changed
        ? "Feedback status updated"
        : "Status is already current",
    };
  } catch (error) {
    return failAction(
      "update-feedback-status",
      error,
      "Could not update feedback — please try again.",
    );
  }
}
