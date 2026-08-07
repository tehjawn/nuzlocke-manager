"use client";

import { useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { CelebrationKind } from "@/features/fx/fx-events";
import { prefersReducedMotion } from "@/features/fx/fx-prefs";

type CelebrationOptions = {
  /** Override particle count for confetti kinds. */
  confettiCount?: number;
};

type CelebrationItem = {
  id: string;
  kind: CelebrationKind;
  confettiCount?: number;
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
export function pushCelebration(
  kind: CelebrationKind,
  durationMs = 1600,
  options: CelebrationOptions = {},
) {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;

  clearCelebrationTimers();

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  items = [
    {
      id,
      kind,
      confettiCount: options.confettiCount,
    },
  ];
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
  guide_chapter: "Chapter clear!",
  guide_complete: "Guide complete!",
};

const CONFETTI_KINDS = new Set<CelebrationKind>([
  "guide_chapter",
  "guide_complete",
]);

/** Deterministic particle seeds so SSR/client markup stays stable for a given id. */
function confettiPieces(
  kind: CelebrationKind,
  seed: string,
  confettiCount?: number,
) {
  const count = confettiCount ?? (kind === "guide_complete" ? 48 : 18);
  const pieces = [];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  for (let i = 0; i < count; i += 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const left = (hash % 1000) / 10;
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const delay = (hash % 450) / 1000;
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const duration = 1.1 + (hash % 900) / 1000;
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const drift = -40 + (hash % 80);
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const hue = hash % 360;
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const rotate = hash % 360;
    pieces.push({ left, delay, duration, drift, hue, rotate });
  }
  return pieces;
}

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

  const active = celebrations[0]!;
  const showConfetti = CONFETTI_KINDS.has(active.kind);
  const pieces = showConfetti
    ? confettiPieces(active.kind, active.id, active.confettiCount)
    : [];

  return createPortal(
    <div
      className={`pointer-events-none fixed inset-0 z-[115] flex items-start justify-center pt-[12vh] ${
        active.kind === "guide_complete" ? "fx-celebration-stage--finale" : ""
      }`}
      aria-live="polite"
      aria-relevant="additions"
      data-fx-celebration={active.kind}
    >
      {showConfetti && (
        <div className={`fx-confetti fx-confetti--${active.kind}`} aria-hidden>
          {pieces.map((piece, index) => (
            <span
              key={index}
              className="fx-confetti__piece"
              style={
                {
                  left: `${piece.left}%`,
                  "--fx-confetti-delay": `${piece.delay}s`,
                  "--fx-confetti-duration": `${piece.duration}s`,
                  "--fx-confetti-drift": `${piece.drift}px`,
                  "--fx-confetti-hue": String(piece.hue),
                  "--fx-confetti-rotate": `${piece.rotate}deg`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
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
