export const FEEDBACK_CATEGORIES = [
  "BUG",
  "FEATURE_REQUEST",
  "SUPPORT",
  "OTHER",
] as const;

export const FEEDBACK_STATUSES = ["NEW", "IN_REVIEW", "RESOLVED"] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export type FeedbackSubmissionItem = {
  category: FeedbackCategory;
  createdAt: string;
  id: string;
  message: string;
  requesterName: string;
  status: FeedbackStatus;
  subject: string;
  updatedAt: string;
};

const FEEDBACK_REVIEW_ACTION_PREFIX = "feedback-review:";
const FEEDBACK_STATUS_ACTION_PREFIX = "feedback-status:";
const CHALLENGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function feedbackCategoryLabel(category: FeedbackCategory): string {
  switch (category) {
    case "BUG":
      return "Bug report";
    case "FEATURE_REQUEST":
      return "Feature request";
    case "SUPPORT":
      return "Help / support";
    case "OTHER":
      return "Other";
  }
}

export function feedbackStatusLabel(status: FeedbackStatus): string {
  switch (status) {
    case "NEW":
      return "New";
    case "IN_REVIEW":
      return "In review";
    case "RESOLVED":
      return "Resolved";
  }
}

export function feedbackStatusClass(status: FeedbackStatus) {
  switch (status) {
    case "NEW":
      return "border-accent/35 bg-accent/10 text-accent-deep";
    case "IN_REVIEW":
      return "border-interactive/35 bg-interactive-soft text-ink";
    case "RESOLVED":
      return "border-frame bg-surface text-muted";
  }
}

export function formatFeedbackDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

export function feedbackReviewActionKey(slug: string, submissionId: string) {
  return `${FEEDBACK_REVIEW_ACTION_PREFIX}${slug}:${submissionId}`;
}

export function feedbackStatusActionKey(
  slug: string,
  submissionId: string,
  status: FeedbackStatus,
) {
  return `${FEEDBACK_STATUS_ACTION_PREFIX}${slug}:${submissionId}:${status}`;
}

export function feedbackNotificationHref(actionKey: string | null) {
  if (!actionKey) return null;

  const isReview = actionKey.startsWith(FEEDBACK_REVIEW_ACTION_PREFIX);
  const isStatus = actionKey.startsWith(FEEDBACK_STATUS_ACTION_PREFIX);
  if (!isReview && !isStatus) return null;

  const prefix = isReview
    ? FEEDBACK_REVIEW_ACTION_PREFIX
    : FEEDBACK_STATUS_ACTION_PREFIX;
  const slug = actionKey.slice(prefix.length).split(":", 1)[0];
  if (!CHALLENGE_SLUG_PATTERN.test(slug)) return null;

  return isReview
    ? `/challenges/${slug}/gm?tab=feedback`
    : `/challenges/${slug}/feedback`;
}
