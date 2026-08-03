import { z } from "zod";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
} from "@/lib/feedback-types";

export const submitFeedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  challengeId: z.string().trim().min(1).max(64),
  message: z.string().trim().min(10).max(2_000),
  subject: z.string().trim().min(3).max(100),
});

export const updateFeedbackStatusSchema = z.object({
  challengeId: z.string().trim().min(1).max(64),
  /** Empty / whitespace clears the shared GM note. */
  gmNote: z.string().max(2_000),
  status: z.enum(FEEDBACK_STATUSES),
  submissionId: z.string().trim().min(1).max(64),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
export type UpdateFeedbackStatusInput = z.infer<
  typeof updateFeedbackStatusSchema
>;
