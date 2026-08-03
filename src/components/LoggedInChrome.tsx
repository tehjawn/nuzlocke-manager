"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  archiveNotificationAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { OnboardingTour } from "@/components/OnboardingTour";
import { UserMenu } from "@/components/UserMenu";
import {
  ONBOARDING_STEPS,
  readOnboardingActive,
  writeOnboardingActive,
  writeOnboardingStep,
} from "@/lib/onboarding";
import { feedbackNotificationHref } from "@/lib/feedback-types";
import {
  isWelcomeNotification,
  type NotificationItem,
  withPinnedWelcome,
} from "@/lib/notification-types";

type LoggedInChromeProps = {
  name: string;
  image: string | null;
  notifications: NotificationItem[];
  signOutAction: () => Promise<void>;
  /** Desktop profile-menu GM entry (mobile uses the hamburger drawer). */
  gmHref?: string | null;
  feedbackHref?: string | null;
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
  gmHref = null,
  feedbackHref = null,
}: LoggedInChromeProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [notifications, setNotifications] = useState(() =>
    withPinnedWelcome(initialNotifications),
  );
  const [tourOpen, setTourOpen] = useState(() => {
    const pinned = withPinnedWelcome(initialNotifications);
    const unread = hasUnreadWelcome(pinned);
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

  async function dismissNotification(notification: NotificationItem) {
    if (isWelcomeNotification(notification)) return;
    setNotifications((prev) =>
      withPinnedWelcome(prev.filter((n) => n.id !== notification.id)),
    );
    const result = await archiveNotificationAction(notification.id);
    if (!result.ok) {
      // Re-insert only this row against latest state so overlapping dismissals
      // that already succeeded are not resurrected by a stale snapshot.
      setNotifications((prev) =>
        prev.some((n) => n.id === notification.id)
          ? prev
          : withPinnedWelcome(
              [...prev, notification].sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
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
    const href = feedbackNotificationHref(notification.actionKey);
    if (href) router.push(href);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <NotificationsMenu
          notifications={notifications}
          unreadCount={unreadCount}
          onDismiss={dismissNotification}
          onSelect={onSelectNotification}
        />
        {/* On mobile the account actions live in the nav drawer instead. */}
        <span className="hidden sm:block">
          <UserMenu
            feedbackHref={feedbackHref}
            gmHref={gmHref}
            image={image}
            name={name}
            signOutAction={signOutAction}
          />
        </span>
      </div>
      <OnboardingTour open={tourOpen} onDismiss={dismissTour} />
    </>
  );
}
