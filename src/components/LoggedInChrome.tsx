"use client";

import { useState } from "react";
import { markNotificationReadAction } from "@/app/actions/notifications";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { UserMenu } from "@/components/UserMenu";
import { WelcomeModal } from "@/components/WelcomeModal";
import type { NotificationItem } from "@/lib/notifications";
import {
  NOTIFICATION_ACTION_WELCOME,
  NOTIFICATION_TYPE_WELCOME,
} from "@/lib/notifications";

type LoggedInChromeProps = {
  name: string;
  image: string | null;
  notifications: NotificationItem[];
  signOutAction: () => Promise<void>;
};

function hasUnreadWelcome(items: NotificationItem[]) {
  return items.some(
    (n) =>
      !n.readAt &&
      (n.type === NOTIFICATION_TYPE_WELCOME ||
        n.actionKey === NOTIFICATION_ACTION_WELCOME),
  );
}

function findWelcome(items: NotificationItem[]) {
  return items.find(
    (n) =>
      n.type === NOTIFICATION_TYPE_WELCOME ||
      n.actionKey === NOTIFICATION_ACTION_WELCOME,
  );
}

export function LoggedInChrome({
  name,
  image,
  notifications: initialNotifications,
  signOutAction,
}: LoggedInChromeProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [welcomeOpen, setWelcomeOpen] = useState(() =>
    hasUnreadWelcome(initialNotifications),
  );

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function markRead(notification: NotificationItem) {
    if (notification.readAt) return;
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notification.id
          ? { ...n, readAt: new Date().toISOString() }
          : n,
      ),
    );
    const result = await markNotificationReadAction(notification.id);
    if (!result.ok) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id
            ? { ...n, readAt: notification.readAt }
            : n,
        ),
      );
    }
  }

  async function dismissWelcome() {
    const welcome = findWelcome(notifications);
    if (welcome) {
      await markRead(welcome);
    }
    setWelcomeOpen(false);
  }

  async function onSelectNotification(notification: NotificationItem) {
    await markRead(notification);
    if (
      notification.type === NOTIFICATION_TYPE_WELCOME ||
      notification.actionKey === NOTIFICATION_ACTION_WELCOME
    ) {
      setWelcomeOpen(true);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <NotificationsMenu
          notifications={notifications}
          unreadCount={unreadCount}
          onSelect={onSelectNotification}
        />
        <UserMenu
          name={name}
          image={image}
          signOutAction={signOutAction}
        />
      </div>
      <WelcomeModal open={welcomeOpen} onDismiss={dismissWelcome} />
    </>
  );
}
