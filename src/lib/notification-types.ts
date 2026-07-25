/** Client-safe notification constants + DTOs (no DB imports). */

export const NOTIFICATION_TYPE_WELCOME = "WELCOME";
export const NOTIFICATION_ACTION_WELCOME = "welcome";

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
