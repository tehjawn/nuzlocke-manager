"use server";

import { auth } from "@/auth";
import {
  archiveNotification,
  markNotificationRead,
  markWelcomeNotificationRead,
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

/** Unlock full season chrome after Get Started / first-run funnel. */
export async function completeFirstRunAction(): Promise<NotificationActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, error: "Sign in required." };
  }

  const notification = await markWelcomeNotificationRead(userId);
  if (!notification) {
    return { ok: false, error: "Welcome notification not found." };
  }

  return { ok: true, notification };
}

export async function archiveNotificationAction(
  notificationId: string,
): Promise<NotificationActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, error: "Sign in required." };
  }

  const notification = await archiveNotification(userId, notificationId);
  if (!notification) {
    return { ok: false, error: "Notification not found." };
  }

  return { ok: true, notification };
}
