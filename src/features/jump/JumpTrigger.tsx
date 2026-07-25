"use client";

import { useSyncExternalStore } from "react";
import { useJumpOptional } from "@/features/jump/JumpProvider";

type JumpTriggerProps = {
  className?: string;
  /** Show the ⌘K / Ctrl+K hint (desktop headers). */
  showShortcut?: boolean;
  /** Called just before Jump opens (e.g. close a mobile drawer). */
  onBeforeOpen?: () => void;
};

function subscribeNoop() {
  return () => {};
}

function shortcutLabel() {
  if (typeof navigator === "undefined") return "⌘K";
  const mac = /Mac|iPhone|iPad|iPod/i.test(
    navigator.platform || navigator.userAgent,
  );
  return mac ? "⌘K" : "Ctrl+K";
}

/**
 * Discoverable Jump entry point for the site header / mobile drawer.
 */
export function JumpTrigger({
  className = "",
  showShortcut = true,
  onBeforeOpen,
}: JumpTriggerProps) {
  const jump = useJumpOptional();
  const shortcut = useSyncExternalStore(
    subscribeNoop,
    shortcutLabel,
    () => "⌘K",
  );
  if (!jump) return null;

  return (
    <button
      type="button"
      onClick={() => {
        onBeforeOpen?.();
        jump.setOpen(true);
      }}
      aria-label="Jump — search and navigate"
      title={`Jump (${shortcut})`}
      className={`pressable inline-flex h-9 items-center gap-2 border-frame bg-surface px-2.5 font-medium hover:border-interactive/50 sm:px-3 ${className}`}
    >
      <SearchGlyph className="h-4 w-4 shrink-0 text-ink/70" />
      <span className="hidden text-sm sm:inline">Jump</span>
      {showShortcut ? (
        <kbd className="hidden rounded border border-frame/80 bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-muted md:inline">
          {shortcut}
        </kbd>
      ) : null}
    </button>
  );
}

function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="8.5" cy="8.5" r="5.25" />
      <path d="M12.5 12.5 16.5 16.5" strokeLinecap="round" />
    </svg>
  );
}
