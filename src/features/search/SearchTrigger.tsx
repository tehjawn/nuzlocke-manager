"use client";

import { useSyncExternalStore } from "react";
import { useSearchOptional } from "@/features/search/SearchProvider";

type SearchTriggerProps = {
  className?: string;
  /** Show the ⌘K / Ctrl+K hint (desktop headers). */
  showShortcut?: boolean;
  /** Called just before Search opens (e.g. close a mobile drawer). */
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
 * Discoverable Search entry point for the site header / mobile drawer.
 */
export function SearchTrigger({
  className = "",
  showShortcut = true,
  onBeforeOpen,
}: SearchTriggerProps) {
  const search = useSearchOptional();
  const shortcut = useSyncExternalStore(
    subscribeNoop,
    shortcutLabel,
    () => "⌘K",
  );
  if (!search) return null;

  return (
    <button
      type="button"
      onClick={() => {
        onBeforeOpen?.();
        search.setOpen(true);
      }}
      aria-label="Search and navigate"
      title={`Search (${shortcut})`}
      className={`pressable inline-flex h-9 items-center gap-2 border-frame/55 bg-surface-2/70 px-2.5 font-medium text-muted hover:border-frame hover:bg-surface hover:text-ink sm:min-w-[9.75rem] sm:px-3.5 ${className}`}
    >
      <SearchGlyph className="h-4 w-4 shrink-0 text-muted" />
      <span className="hidden text-sm sm:inline">Search</span>
      {showShortcut ? (
        <kbd className="ml-auto hidden rounded border border-frame/60 bg-surface/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-muted/80 md:inline">
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
