import { getPrisma } from "@/lib/db";
import {
  NOTIFICATION_ACTION_WELCOME,
  NOTIFICATION_TYPE_WELCOME,
  WELCOME_NOTIFICATION,
  withPinnedWelcome,
  type NotificationItem,
} from "@/lib/notification-types";

export type { NotificationItem } from "@/lib/notification-types";
export {
  NOTIFICATION_ACTION_WELCOME,
  NOTIFICATION_TYPE_WELCOME,
  WELCOME_NOTIFICATION,
  isWelcomeNotification,
  withPinnedWelcome,
} from "@/lib/notification-types";

function toItem(row: {
  id: string;
  type: string;
  title: string;
  body: string | null;
  actionKey: string | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    actionKey: row.actionKey,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** First-login welcome for Trash Pack 2026 — idempotent per user. */
export async function ensureWelcomeNotification(userId: string) {
  const prisma = getPrisma();
  return prisma.notification.upsert({
    where: {
      userId_type_actionKey: {
        userId,
        type: NOTIFICATION_TYPE_WELCOME,
        actionKey: NOTIFICATION_ACTION_WELCOME,
      },
    },
    create: {
      userId,
      type: WELCOME_NOTIFICATION.type,
      actionKey: WELCOME_NOTIFICATION.actionKey,
      title: WELCOME_NOTIFICATION.title,
      body: WELCOME_NOTIFICATION.body,
    },
    update: {
      title: WELCOME_NOTIFICATION.title,
      body: WELCOME_NOTIFICATION.body,
    },
  });
}

export async function listNotificationsForUser(
  userId: string,
  limit = 20,
): Promise<NotificationItem[]> {
  const prisma = getPrisma();
  // Every signed-in player gets the hard-coded welcome row (for read-state).
  await ensureWelcomeNotification(userId);
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      actionKey: true,
      readAt: true,
      createdAt: true,
    },
  });
  return withPinnedWelcome(rows.map(toItem));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<NotificationItem | null> {
  const prisma = getPrisma();
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!existing) return null;
  if (existing.readAt) {
    return toItem(existing);
  }
  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
  return toItem(updated);
}
