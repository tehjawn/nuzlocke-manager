"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type TrainerBoardMenuItem = {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  tone?: "danger" | "neutral";
};

type TrainerBoardActionsMenuProps = {
  items: TrainerBoardMenuItem[];
};

/**
 * Overflow disclosure for secondary trainer-board verbs (#325). Same click /
 * Esc / outside-press model as `ToolsMenu` / `HeaderMenu`, but menuitems are
 * buttons (modal openers / clipboard) rather than links.
 */
export function TrainerBoardActionsMenu({
  items,
}: TrainerBoardActionsMenuProps) {
  const itemCount = items.length;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const id = useId();
  const menuId = `${id}-menu`;
  const triggerId = `${id}-trigger`;

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

  if (itemCount === 0) return null;

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
        aria-label="More board actions"
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
        className="pressable inline-flex h-9 items-center gap-1.5 border-frame bg-surface px-3 text-xs font-semibold tracking-tight text-ink"
      >
        <MoreActionsIcon />
        More
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <div className="absolute top-full right-0 z-50 pt-1">
          <div
            id={menuId}
            role="menu"
            aria-labelledby={triggerId}
            onKeyDown={onMenuKeyDown}
            className="gba-frame gba-frame-menu w-52 overflow-hidden"
          >
            {items.map((item, index) => {
              const danger = item.tone === "danger";
              return (
                <button
                  key={item.key}
                  ref={(node) => {
                    itemsRef.current[index] = node;
                  }}
                  type="button"
                  role="menuitem"
                  title={item.title}
                  disabled={item.disabled}
                  tabIndex={index === rovingIndex ? 0 : -1}
                  onClick={() => {
                    if (item.disabled) return;
                    dismiss();
                    item.onClick();
                  }}
                  className={`relative z-[1] flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium focus-visible:outline-none disabled:opacity-60 ${
                    danger
                      ? "text-danger hover:bg-danger/10 focus-visible:bg-danger/10"
                      : "hover:bg-interactive-soft/50 focus-visible:bg-interactive-soft/50"
                  }`}
                >
                  <span
                    className={`shrink-0 ${danger ? "text-danger" : "text-ink/70"}`}
                    aria-hidden
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MoreActionsIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="3.5" cy="8" r="1.25" />
      <circle cx="8" cy="8" r="1.25" />
      <circle cx="12.5" cy="8" r="1.25" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 text-muted transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
