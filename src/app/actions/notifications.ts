"use server";

import { auth } from "@/auth";
import {
  markNotificationRead,
  type NotificationItem,
} from "@/lib/notifications";

export type NotificationActionResult =
  | { ok: true; notification: NotificationItem }
  | { ok: false; error: string };

export async function markNotificationReadAction(
  notificationId: string,
): Promise<NotificationActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, error: "Sign in required." };
  }

  const notification = await markNotificationRead(userId, notificationId);
  if (!notification) {
    return { ok: false, error: "Notification not found." };
  }

  return { ok: true, notification };
}
