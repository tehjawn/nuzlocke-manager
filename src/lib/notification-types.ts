/** Client-safe notification constants + DTOs (no DB imports). */

export const NOTIFICATION_TYPE_WELCOME = "WELCOME";
export const NOTIFICATION_TYPE_REACTION = "REACTION";
export const NOTIFICATION_TYPE_FEEDBACK = "FEEDBACK";
export const NOTIFICATION_TYPE_FEEDBACK_STATUS = "FEEDBACK_STATUS";
export const NOTIFICATION_TYPE_FEEDBACK_NOTE = "FEEDBACK_NOTE";

export const NOTIFICATION_ACTION_WELCOME = "welcome";

const REACTION_ACTION_PREFIX = "reaction:";
const CHALLENGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Hard-coded welcome inbox row — always pinned first; not dismissable. */
export const WELCOME_NOTIFICATION = {
  type: NOTIFICATION_TYPE_WELCOME,
  actionKey: NOTIFICATION_ACTION_WELCOME,
  title: "Welcome to Trash Pack 2026!",
  body: "Customize your trainer, then open Get Started to download the ROM and sync your save. Tap here anytime for a guided tour.",
} as const;

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  actionKey: string | null;
  /** ISO timestamp or null — safe to pass into client components. */
  readAt: string | null;
  /** ISO timestamp — safe to pass into client components. */
  createdAt: string;
};

export function isWelcomeNotification(notification: {
  type: string;
  actionKey: string | null;
}) {
  return (
    notification.type === NOTIFICATION_TYPE_WELCOME ||
    notification.actionKey === NOTIFICATION_ACTION_WELCOME
  );
}

/** Pin the hard-coded welcome row first; merge read state from a DB row when present. */
export function withPinnedWelcome(
  notifications: NotificationItem[],
): NotificationItem[] {
  const existing = notifications.find(isWelcomeNotification);
  const welcome: NotificationItem = {
    id: existing?.id ?? "welcome",
    type: WELCOME_NOTIFICATION.type,
    actionKey: WELCOME_NOTIFICATION.actionKey,
    title: WELCOME_NOTIFICATION.title,
    body: WELCOME_NOTIFICATION.body,
    readAt: existing?.readAt ?? null,
    createdAt: existing?.createdAt ?? new Date(0).toISOString(),
  };
  const rest = notifications.filter((n) => !isWelcomeNotification(n));
  return [welcome, ...rest];
}

/**
 * One row per (recipient, activity, reactor) — re-reacting upserts instead of
 * stacking (matches activity coalesce discipline).
 */
export function reactionActionKey(
  slug: string,
  activityId: string,
  actorId: string,
) {
  return `${REACTION_ACTION_PREFIX}${slug}:${activityId}:${actorId}`;
}

/** Deep-link Pack Activity for reaction notifications. */
export function reactionNotificationHref(actionKey: string | null) {
  if (!actionKey?.startsWith(REACTION_ACTION_PREFIX)) return null;
  const slug = actionKey.slice(REACTION_ACTION_PREFIX.length).split(":", 1)[0];
  if (!CHALLENGE_SLUG_PATTERN.test(slug)) return null;
  return `/challenges/${slug}/activity`;
}
