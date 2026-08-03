/** Client-safe notification constants + DTOs (no DB imports). */

export const NOTIFICATION_TYPE_WELCOME = "WELCOME";
export const NOTIFICATION_ACTION_WELCOME = "welcome";

/** Hard-coded welcome inbox row — pinned first when present and not archived. */
export const WELCOME_NOTIFICATION = {
  type: NOTIFICATION_TYPE_WELCOME,
  actionKey: NOTIFICATION_ACTION_WELCOME,
  title: "Welcome to Trash Pack 2026!",
  body: "Take the app tour — your trainer board, the Season 2026 trainers list, then Get Started.",
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

/**
 * Pin a welcome row first when one is already in the list.
 * Does not invent a sentinel — archived / missing welcome stays gone.
 */
export function withPinnedWelcome(
  notifications: NotificationItem[],
): NotificationItem[] {
  const existing = notifications.find(isWelcomeNotification);
  if (!existing) return notifications;
  const welcome: NotificationItem = {
    ...existing,
    type: WELCOME_NOTIFICATION.type,
    actionKey: WELCOME_NOTIFICATION.actionKey,
    title: WELCOME_NOTIFICATION.title,
    body: WELCOME_NOTIFICATION.body,
  };
  const rest = notifications.filter((n) => !isWelcomeNotification(n));
  return [welcome, ...rest];
}
