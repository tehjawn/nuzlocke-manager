"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { CelebrationKind } from "@/features/fx/fx-events";
import { prefersReducedMotion } from "@/features/fx/fx-prefs";

type CelebrationItem = {
  id: string;
  kind: CelebrationKind;
};

let items: CelebrationItem[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const listener of listeners) listener();
}

function clearCelebrationTimers() {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}

function dismissCelebration(id: string) {
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

/** Fire-and-forget celebration — same module-store pattern as snackbars. */
export function pushCelebration(kind: CelebrationKind, durationMs = 1600) {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;

  clearCelebrationTimers();

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  items = [{ id, kind }];
  emit();
  timers.set(
    id,
    setTimeout(() => dismissCelebration(id), durationMs),
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

const EMPTY: CelebrationItem[] = [];

function getServerSnapshot(): CelebrationItem[] {
  return EMPTY;
}

const KIND_LABEL: Record<CelebrationKind, string> = {
  catch: "Caught!",
  shiny: "Shiny!",
  badge: "Badge earned!",
  champion: "Champion!",
  lock: "Squad locked!",
  join: "Welcome!",
};

/**
 * Mount once near the app root (next to SnackbarHost).
 * No portal until a celebration is active — avoids mount/hydration effects.
 */
export function CelebrationHost() {
  const celebrations = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (celebrations.length === 0 || typeof document === "undefined") {
    return null;
  }

  const active = celebrations[0];

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[115] flex items-start justify-center pt-[12vh]"
      aria-live="polite"
      aria-relevant="additions"
      data-fx-celebration={active.kind}
    >
      <div
        key={active.id}
        role="status"
        className={`fx-celebration fx-celebration--${active.kind}`}
      >
        <span className="fx-celebration__burst" aria-hidden />
        <span className="fx-celebration__label">{KIND_LABEL[active.kind]}</span>
      </div>
    </div>,
    document.body,
  );
}
