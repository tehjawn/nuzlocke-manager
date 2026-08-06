"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type HeaderMenuItem = {
  href: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  /** Accent row — primary pick inside the menu (e.g. My Trainer). */
  accent?: boolean;
};

type HeaderMenuProps = {
  label: string;
  icon: ReactNode;
  items: HeaderMenuItem[];
  /** Optional wider panel for two-line rows. */
  menuClassName?: string;
  /** Override the default trigger pill classes (border / text theme). */
  triggerClassName?: string;
  /** Override the default icon tint (`text-ink/70`). */
  iconClassName?: string;
  /** Override the default chevron tint (`text-muted`). */
  chevronClassName?: string;
};

/**
 * Shared click-to-open header disclosure (#287). Same interaction model as
 * `ToolsMenu`: Esc + outside click, close on navigate, WAI-ARIA menu-button
 * keyboard (arrows / Home / End). Click-only — hover-open races the toggle.
 */
export function HeaderMenu({
  label,
  icon,
  items,
  menuClassName = "w-52",
  triggerClassName = "pressable inline-flex h-9 items-center gap-2 border-frame bg-surface px-3.5 font-medium hover:border-interactive/50",
  iconClassName = "text-ink/70",
  chevronClassName = "text-muted",
}: HeaderMenuProps) {
  const itemCount = items.length;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const pathname = usePathname();
  const [seenPath, setSeenPath] = useState(pathname);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<Array<HTMLAnchorElement | null>>([]);
  const id = useId();
  const menuId = `${id}-menu`;
  const triggerId = `${id}-trigger`;

  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (open) {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

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
    openAt(event.detail === 0 ? 0 : -1);
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openAt(0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openAt(itemCount - 1);
    }
  }

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (itemCount === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % itemCount);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? itemCount - 1 : i - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(itemCount - 1);
    }
  }

  function onFocusOut(event: React.FocusEvent<HTMLDivElement>) {
    if (!event.relatedTarget) return;
    if (rootRef.current?.contains(event.relatedTarget as Node)) return;
    dismiss();
  }

  if (itemCount === 0) return null;

  const rovingIndex = activeIndex < 0 ? 0 : activeIndex;

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
        className={triggerClassName}
      >
        <span className={iconClassName} aria-hidden>
          {icon}
        </span>
        {label}
        <ChevronIcon open={open} className={chevronClassName} />
      </button>

      {open ? (
        <div className="absolute top-full right-0 z-50 pt-1">
          <div
            id={menuId}
            role="menu"
            aria-labelledby={triggerId}
            onKeyDown={onMenuKeyDown}
            className={`gba-frame gba-frame-menu overflow-hidden ${menuClassName}`}
          >
            {items.map((item, index) => (
              <Link
                key={item.href}
                ref={(node) => {
                  itemsRef.current[index] = node;
                }}
                href={item.href}
                role="menuitem"
                tabIndex={index === rovingIndex ? 0 : -1}
                onClick={dismiss}
                className={
                  item.accent
                    ? "relative z-[1] flex items-center gap-2.5 bg-accent/12 px-2.5 py-2 font-semibold text-accent-deep hover:bg-accent/20 focus-visible:bg-accent/20 focus-visible:outline-none"
                    : "relative z-[1] flex items-center gap-2.5 px-2.5 py-2 hover:bg-interactive-soft/50 focus-visible:bg-interactive-soft/50 focus-visible:outline-none"
                }
              >
                {item.icon ? (
                  <span
                    className={
                      item.accent ? "shrink-0 text-accent-deep" : "shrink-0 text-ink/70"
                    }
                    aria-hidden
                  >
                    {item.icon}
                  </span>
                ) : null}
                <span className="min-w-0">
                  <span className="block truncate text-sm leading-tight">
                    {item.label}
                  </span>
                  {item.description ? (
                    <span className="mt-0.5 block truncate text-xs font-normal leading-snug text-muted">
                      {item.description}
                    </span>
                  ) : null}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChevronIcon({
  open,
  className = "text-muted",
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 transition-transform ${className} ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
