import { getPrisma } from "@/lib/db";
import {
  NOTIFICATION_ACTION_WELCOME,
  NOTIFICATION_TYPE_WELCOME,
  WELCOME_NOTIFICATION,
  isWelcomeNotification,
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

type WelcomeRow = {
  type: string;
  actionKey: string | null;
};

export async function prependPersistedWelcome<T extends WelcomeRow>(
  rows: T[],
  findWelcome: () => Promise<T | null>,
  ensureWelcome: () => Promise<T>,
): Promise<T[]> {
  if (rows.some(isWelcomeNotification)) return rows;
  const welcome = (await findWelcome()) ?? (await ensureWelcome());
  return [welcome, ...rows];
}

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

const notificationListSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  actionKey: true,
  readAt: true,
  createdAt: true,
} as const;

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
  // Happy path is read-only. Backfill welcome only when the row is missing
  // (failed sign-in upsert) — not on every header render. Welcome is always
  // shown (not dismissable); clear a stale archive if one was set earlier.
  let rows = await prisma.notification.findMany({
    where: {
      userId,
      archivedAt: null,
      NOT: {
        OR: [
          { type: NOTIFICATION_TYPE_WELCOME },
          { actionKey: NOTIFICATION_ACTION_WELCOME },
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: notificationListSelect,
  });

  const welcome = await prisma.notification.findUnique({
    where: {
      userId_type_actionKey: {
        userId,
        type: NOTIFICATION_TYPE_WELCOME,
        actionKey: NOTIFICATION_ACTION_WELCOME,
      },
    },
    select: { ...notificationListSelect, archivedAt: true },
  });

  let welcomeRow = welcome;
  if (!welcomeRow) {
    welcomeRow = {
      ...(await ensureWelcomeNotification(userId)),
      archivedAt: null,
    };
  } else if (welcomeRow.archivedAt != null) {
    welcomeRow = await prisma.notification.update({
      where: { id: welcomeRow.id },
      data: { archivedAt: null },
      select: { ...notificationListSelect, archivedAt: true },
    });
  }

  const { archivedAt: _archivedAt, ...welcomeItem } = welcomeRow;
  rows = [welcomeItem, ...rows];

  return withPinnedWelcome(rows.map(toItem));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.notification.count({
    where: { userId, readAt: null, archivedAt: null },
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
  // Welcome is never dismissable; other archived rows stay out of the inbox.
  if (existing.archivedAt && !isWelcomeNotification(existing)) return null;
  if (existing.readAt && !existing.archivedAt) {
    return toItem(existing);
  }
  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      readAt: existing.readAt ?? new Date(),
      ...(isWelcomeNotification(existing) ? { archivedAt: null } : {}),
    },
  });
  return toItem(updated);
}

/** Soft-dismiss from the inbox. Also marks read so badges stay clear. */
export async function archiveNotification(
  userId: string,
  notificationId: string,
): Promise<NotificationItem | null> {
  const prisma = getPrisma();
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!existing) return null;
  // Pinned welcome tour entry stays in the inbox permanently.
  if (isWelcomeNotification(existing)) return null;
  if (existing.archivedAt) {
    return toItem(existing);
  }
  const now = new Date();
  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      archivedAt: now,
      readAt: existing.readAt ?? now,
    },
  });
  return toItem(updated);
}
