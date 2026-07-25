"use client";

import { useState } from "react";
import { markNotificationReadAction } from "@/app/actions/notifications";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { UserMenu } from "@/components/UserMenu";
import { WelcomeModal } from "@/components/WelcomeModal";
import type { NotificationItem } from "@/lib/notification-types";
import {
  isWelcomeNotification,
  withPinnedWelcome,
} from "@/lib/notification-types";

type LoggedInChromeProps = {
  name: string;
  image: string | null;
  notifications: NotificationItem[];
  signOutAction: () => Promise<void>;
};

function hasUnreadWelcome(items: NotificationItem[]) {
  return items.some((n) => !n.readAt && isWelcomeNotification(n));
}

function findWelcome(items: NotificationItem[]) {
  return items.find(isWelcomeNotification);
}

export function LoggedInChrome({
  name,
  image,
  notifications: initialNotifications,
  signOutAction,
}: LoggedInChromeProps) {
  const [notifications, setNotifications] = useState(() =>
    withPinnedWelcome(initialNotifications),
  );
  const [welcomeOpen, setWelcomeOpen] = useState(() =>
    hasUnreadWelcome(withPinnedWelcome(initialNotifications)),
  );

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function markRead(notification: NotificationItem) {
    if (notification.readAt) return;
    // Sentinel id used only when DB has not provisioned a welcome row yet.
    if (notification.id === "welcome") {
      setNotifications((prev) =>
        withPinnedWelcome(
          prev.map((n) =>
            isWelcomeNotification(n)
              ? { ...n, readAt: new Date().toISOString() }
              : n,
          ),
        ),
      );
      return;
    }
    setNotifications((prev) =>
      withPinnedWelcome(
        prev.map((n) =>
          n.id === notification.id
            ? { ...n, readAt: new Date().toISOString() }
            : n,
        ),
      ),
    );
    const result = await markNotificationReadAction(notification.id);
    if (!result.ok) {
      setNotifications((prev) =>
        withPinnedWelcome(
          prev.map((n) =>
            n.id === notification.id
              ? { ...n, readAt: notification.readAt }
              : n,
          ),
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
    if (isWelcomeNotification(notification)) {
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
