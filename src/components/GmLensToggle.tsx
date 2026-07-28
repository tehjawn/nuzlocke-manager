"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { writeGmLensOnClient } from "@/lib/gm-lens";

type GmLensToggleProps = {
  slug: string;
  initialOn: boolean;
  /** Full-width row for the mobile drawer. */
  variant?: "header" | "drawer";
};

/**
 * Opt-in GM lens: when on, GMs can see competitive builds and edit other
 * trainers’ boards. Off = player lens (own board only).
 */
export function GmLensToggle({
  slug,
  initialOn,
  variant = "header",
}: GmLensToggleProps) {
  const router = useRouter();
  const [on, setOn] = useState(initialOn);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    writeGmLensOnClient(slug, next);
    startTransition(() => {
      router.refresh();
    });
  }

  if (variant === "drawer") {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={pending}
        onClick={toggle}
        className={`pressable flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
          on
            ? "border-accent/40 bg-accent/15 text-ink"
            : "border-frame bg-surface text-ink hover:border-interactive/50"
        }`}
      >
        <span className="min-w-0">
          <span className="block">GM lens</span>
          <span className="mt-0.5 block text-xs font-medium text-muted">
            {on
              ? "Seeing other trainers' builds"
              : "Player view — own board only"}
          </span>
        </span>
        <span
          className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
            on ? "bg-accent" : "bg-frame"
          }`}
          aria-hidden
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform ${
              on ? "translate-x-4" : ""
            }`}
          />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={
        on
          ? "GM lens on — viewing competitive details for all trainers"
          : "GM lens off — player view"
      }
      title={
        on
          ? "GM lens on — click to return to player view"
          : "GM lens off — click to view other trainers' builds"
      }
      disabled={pending}
      onClick={toggle}
      className={`pressable inline-flex h-9 items-center gap-1.5 border px-3 font-semibold transition-colors ${
        on
          ? "border-accent/40 bg-accent/15 text-accent-deep"
          : "border-frame bg-surface text-ink hover:border-interactive/50"
      }`}
    >
      <span className="text-xs tracking-tight">
        {on ? "GM lens on" : "GM lens"}
      </span>
    </button>
  );
}
