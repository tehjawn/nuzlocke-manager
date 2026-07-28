"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export type SnackbarTone = "success" | "error" | "info";

type SnackbarItem = {
  id: string;
  message: string;
  tone: SnackbarTone;
};

let items: SnackbarItem[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const listener of listeners) listener();
}

function dismissSnackbar(id: string) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
}

/** Fire-and-forget snackbar — works from hooks without React context. */
export function pushSnackbar(
  message: string,
  tone: SnackbarTone = "success",
  durationMs = 3200,
) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  items = [...items, { id, message, tone }].slice(-3);
  emit();
  timers.set(
    id,
    setTimeout(() => dismissSnackbar(id), durationMs),
  );
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot() {
  return items;
}

const EMPTY_SERVER_SNAPSHOT: SnackbarItem[] = [];

function getServerSnapshot(): SnackbarItem[] {
  return EMPTY_SERVER_SNAPSHOT;
}

/**
 * Mount once near the app root. Renders a short stack of bottom-center toasts.
 */
export function SnackbarHost() {
  const toasts = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined" || toasts.length === 0) {
    return null;
  }

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[120] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-semibold tracking-tight shadow-lg backdrop-blur-md ${
            toast.tone === "error"
              ? "border-danger/35 bg-danger/95 text-white"
              : toast.tone === "info"
                ? "border-frame bg-surface/95 text-ink"
                : "border-accent/40 bg-accent text-[var(--on-accent)]"
          }`}
        >
          <SnackbarIcon tone={toast.tone} />
          <span className="min-w-0">{toast.message}</span>
          <button
            type="button"
            className="ml-1 shrink-0 rounded px-1 text-current/80 hover:text-current"
            aria-label="Dismiss"
            onClick={() => dismissSnackbar(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

function SnackbarIcon({ tone }: { tone: SnackbarTone }) {
  if (tone === "error") {
    return (
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 shrink-0"
        fill="none"
        aria-hidden
      >
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8 5v4M8 11h.01"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (tone === "info") {
    return (
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 shrink-0"
        fill="none"
        aria-hidden
      >
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8 7.5V11M8 5h.01"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0"
      fill="none"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 8.2 7.2 10l3.5-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
