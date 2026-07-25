/** Client-safe notification constants + DTOs (no DB imports). */

export const NOTIFICATION_TYPE_WELCOME = "WELCOME";
export const NOTIFICATION_ACTION_WELCOME = "welcome";

/** Hard-coded welcome inbox row — always pinned first for every player. */
export const WELCOME_NOTIFICATION = {
  type: NOTIFICATION_TYPE_WELCOME,
  actionKey: NOTIFICATION_ACTION_WELCOME,
  title: "Welcome to Trash Pack 2026!",
  body: "A message from Jason (@Oubori) — open to watch the welcome video.",
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
