"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ToolsIcon } from "@/components/nav-icons";
import { ToolChip } from "@/components/tool-icons";
import {
  TOOLS_CATALOG,
  toolsHref,
  toolsHubHref,
} from "@/lib/tools-routes";

type ToolsMenuProps = {
  slug: string;
};

/** Catalog rows + the trailing "All tools" row, which is also arrow-traversable. */
const HUB_INDEX = TOOLS_CATALOG.length;
const ITEM_COUNT = TOOLS_CATALOG.length + 1;

/**
 * Header disclosure for the whole Tools catalog (#253). Replaces the old Game
 * Guide deep-link pill — same slot, same pixels, every tool. Rendered off
 * `TOOLS_CATALOG`, so adding a tool never needs a header edit.
 *
 * `SiteHeader` is a server component; this is the small client island it needs
 * for the open/close state. Dropdown chrome follows `UserMenu` /
 * `NotificationsMenu`; keyboard behaviour follows the WAI-ARIA menu-button
 * model — arrows traverse, Home/End jump, Esc closes and restores the trigger.
 *
 * Click-only, unlike the two account menus: hover-open races the click toggle
 * (the pointer opens the panel on the way in, then the click reads it as
 * already-open and dismisses), and a nav menu shouldn't fire off just from the
 * cursor crossing the header.
 */
export function ToolsMenu({ slug }: ToolsMenuProps) {
  const [open, setOpen] = useState(false);
  // -1 means "open, but nothing focused yet" — a pointer-opened menu shouldn't
  // yank focus. Any other value drives the roving tabindex and the focus effect.
  const [activeIndex, setActiveIndex] = useState(-1);
  const pathname = usePathname();
  const [seenPath, setSeenPath] = useState(pathname);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<Array<HTMLAnchorElement | null>>([]);
  const id = useId();
  const menuId = `${id}-menu`;
  const triggerId = `${id}-trigger`;

  // Close on navigation. Adjusting state during render (rather than in an
  // effect) is the pattern this codebase uses for prop-derived resets. Tools
  // share one pathname and differ only by `?tool=`, so item clicks close
  // explicitly too — this only covers leaving the tools route entirely.
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (open) {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  // Esc restores the trigger; an outside press just dismisses (focus already
  // went wherever the user clicked).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setActiveIndex(-1);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      setActiveIndex(-1);
      triggerRef.current?.focus();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    itemsRef.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  function dismiss() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function openAt(index: number) {
    setOpen(true);
    setActiveIndex(index);
  }

  function onTriggerClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (open) {
      dismiss();
      return;
    }
    // `detail === 0` means Enter/Space synthesized this click — the keyboard
    // path lands on the first item, a real click just reveals the panel.
    openAt(event.detail === 0 ? 0 : -1);
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openAt(0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openAt(ITEM_COUNT - 1);
    }
  }

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % ITEM_COUNT);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? ITEM_COUNT - 1 : i - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(ITEM_COUNT - 1);
    }
  }

  // Tab / Shift+Tab out of the menu dismisses it without fighting the browser's
  // own focus move. A null relatedTarget means the whole window lost focus (or
  // the panel just unmounted) — leave it alone.
  function onFocusOut(event: React.FocusEvent<HTMLDivElement>) {
    if (!event.relatedTarget) return;
    if (rootRef.current?.contains(event.relatedTarget as Node)) return;
    dismiss();
  }

  // Nothing is auto-focused on a pointer-open, but Tab still has to be able to
  // reach the list, so the first row stays tabbable.
  const rovingIndex = activeIndex < 0 ? 0 : activeIndex;

  const rowClass =
    "relative z-[1] flex items-center gap-2.5 px-2.5 py-2 hover:bg-interactive-soft/50 focus-visible:bg-interactive-soft/50 focus-visible:outline-none";

  return (
    <div ref={rootRef} className="relative" onBlur={onFocusOut}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
        className="pressable inline-flex h-9 items-center gap-2 border-frame bg-surface px-3.5 font-medium hover:border-interactive/50"
      >
        <ToolsIcon className="h-4 w-4 text-ink/70" />
        Tools
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <div className="absolute top-full right-0 z-50 pt-1">
          <div
            id={menuId}
            role="menu"
            aria-labelledby={triggerId}
            onKeyDown={onMenuKeyDown}
            className="gba-frame gba-frame-menu max-h-[calc(100vh-6rem)] w-[17rem] overflow-y-auto"
          >
            {TOOLS_CATALOG.map((tool, index) => (
              <Link
                key={tool.id}
                ref={(node) => {
                  itemsRef.current[index] = node;
                }}
                href={toolsHref(slug, tool.id)}
                role="menuitem"
                tabIndex={index === rovingIndex ? 0 : -1}
                onClick={dismiss}
                className={rowClass}
              >
                <ToolChip id={tool.id} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium leading-tight">
                    {tool.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs leading-snug text-muted">
                    {tool.navLabel}
                  </span>
                </span>
              </Link>
            ))}

            <Link
              ref={(node) => {
                itemsRef.current[HUB_INDEX] = node;
              }}
              href={toolsHubHref(slug)}
              role="menuitem"
              tabIndex={HUB_INDEX === rovingIndex ? 0 : -1}
              onClick={dismiss}
              className={`${rowClass} justify-between border-t border-frame/50 text-xs font-medium text-muted hover:text-ink`}
            >
              All tools
              <span aria-hidden className="text-muted/80">
                →
              </span>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
