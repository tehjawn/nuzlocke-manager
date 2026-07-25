"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { markNotificationReadAction } from "@/app/actions/notifications";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { OnboardingTour } from "@/components/OnboardingTour";
import { UserMenu } from "@/components/UserMenu";
import {
  ONBOARDING_STEPS,
  readOnboardingActive,
  writeOnboardingActive,
  writeOnboardingStep,
} from "@/lib/onboarding";
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
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [notifications, setNotifications] = useState(() =>
    withPinnedWelcome(initialNotifications),
  );
  const [tourOpen, setTourOpen] = useState(() => {
    const unread = hasUnreadWelcome(withPinnedWelcome(initialNotifications));
    const active = readOnboardingActive();
    if (unread || active) {
      writeOnboardingActive(true);
      return true;
    }
    return false;
  });

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

  async function dismissTour() {
    writeOnboardingActive(false);
    const welcome = findWelcome(notifications);
    if (welcome) {
      await markRead(welcome);
    }
    setTourOpen(false);
  }

  function startTour() {
    writeOnboardingStep(0);
    writeOnboardingActive(true);
    setTourOpen(true);
    // Avoid a useless /me bounce if we're already on a trainer board.
    if (!ONBOARDING_STEPS[0].match(pathname)) {
      router.push(ONBOARDING_STEPS[0].href);
    }
  }

  async function onSelectNotification(notification: NotificationItem) {
    if (isWelcomeNotification(notification)) {
      startTour();
      return;
    }
    await markRead(notification);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <NotificationsMenu
          notifications={notifications}
          unreadCount={unreadCount}
          onSelect={onSelectNotification}
        />
        {/* On mobile the account actions live in the nav drawer instead. */}
        <span className="hidden sm:block">
          <UserMenu name={name} image={image} signOutAction={signOutAction} />
        </span>
      </div>
      <OnboardingTour open={tourOpen} onDismiss={dismissTour} />
    </>
  );
}
