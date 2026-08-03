"use client";

import { useEffect, useId, useRef, useState } from "react";
import { feedbackNotificationHref } from "@/lib/feedback-types";
import type { NotificationItem } from "@/lib/notification-types";
import { isWelcomeNotification } from "@/lib/notification-types";
import { useCoarsePointer } from "@/lib/use-coarse-pointer";

type NotificationsMenuProps = {
  notifications: NotificationItem[];
  unreadCount: number;
  onSelect: (notification: NotificationItem) => void;
  onDismiss: (notification: NotificationItem) => void;
};

export function NotificationsMenu({
  notifications,
  unreadCount,
  onSelect,
  onDismiss,
}: NotificationsMenuProps) {
  const [open, setOpen] = useState(false);
  const coarse = useCoarsePointer();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const badgeLabel =
    unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      // Hover-open is a desktop affordance only. On touch the emulated
      // mouseenter would fight the click toggle, so tap drives it there.
      onMouseEnter={coarse ? undefined : () => setOpen(true)}
      onMouseLeave={coarse ? undefined : () => setOpen(false)}
    >
      <button
        type="button"
        className="pressable relative inline-flex h-9 w-9 items-center justify-center bg-surface"
        aria-label={
          badgeLabel
            ? `Notifications, ${badgeLabel} unread`
            : "Notifications"
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon />
        {badgeLabel ? (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-md bg-accent px-1 text-[10px] font-bold leading-none text-[var(--on-accent)]">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-x-2 top-16 z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:pt-1">
          <div
            id={menuId}
            role="menu"
            className="gba-frame gba-frame-menu w-full overflow-hidden sm:w-80"
          >
            <div className="relative z-[1] border-b border-frame/60 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Notifications
              </p>
            </div>
            {notifications.length === 0 ? (
              <p className="relative z-[1] px-3 py-4 text-sm text-muted">
                You&apos;re all caught up.
              </p>
            ) : (
              <ul className="relative z-[1] max-h-80 overflow-y-auto">
                {notifications.map((notification) => {
                  const unread = !notification.readAt;
                  const feedbackHref = feedbackNotificationHref(
                    notification.actionKey,
                  );
                  return (
                    <li key={notification.id} className="relative">
                      <button
                        type="button"
                        role="menuitem"
                        className={`flex w-full flex-col gap-0.5 py-2.5 pr-10 pl-3 text-left hover:bg-accent/15 ${
                          unread ? "bg-accent/8" : ""
                        }`}
                        onClick={() => {
                          onSelect(notification);
                          setOpen(false);
                        }}
                      >
                        <span className="flex items-start gap-2">
                          {unread ? (
                            <span
                              aria-hidden
                              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-sm bg-accent"
                            />
                          ) : (
                            <span
                              aria-hidden
                              className="mt-1.5 h-1.5 w-1.5 shrink-0"
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">
                              {notification.title}
                            </span>
                            {notification.body ? (
                              <span className="mt-0.5 block text-xs text-muted">
                                {notification.body}
                              </span>
                            ) : null}
                            {isWelcomeNotification(notification) ? (
                              <span className="mt-1 block text-[11px] font-semibold text-accent-deep">
                                Start tour →
                              </span>
                            ) : null}
                            {feedbackHref ? (
                              <span className="mt-1 block text-[11px] font-semibold text-accent-deep">
                                Open feedback →
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Dismiss ${notification.title}`}
                        className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-frame/50 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onDismiss(notification);
                        }}
                      >
                        <DismissIcon />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4 text-accent-deep"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M5.5 8.2a4.5 4.5 0 019 0c0 2.2.5 3.3 1.2 4.3H4.3c.7-1 1.2-2.1 1.2-4.3z"
        strokeLinejoin="round"
      />
      <path d="M8.2 14.8a1.8 1.8 0 003.6 0" strokeLinecap="round" />
    </svg>
  );
}

function DismissIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}
