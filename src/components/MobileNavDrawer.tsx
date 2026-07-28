"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GmLensToggle } from "@/components/GmLensToggle";
import {
  AboutIcon,
  GmIcon,
  MyTrainerIcon,
  RulesIcon,
} from "@/components/nav-icons";
import { JumpTrigger } from "@/features/jump";

type NavLink = { href: string; label: string; icon: ReactNode };

type MobileNavDrawerProps = {
  challengeSlug?: string;
  showGm?: boolean;
  myTrainerId?: string | null;
  gmLensOn?: boolean;
  /** Applied to the trigger button (e.g. `sm:hidden`). */
  className?: string;
  /** Account actions (server-rendered): My Profile + Sign Out, or Discord login. */
  children?: ReactNode;
};

/**
 * Hamburger-triggered navigation sheet for narrow viewports. The site header
 * keeps its inline pill row at `sm+`; below that all the header controls — nav
 * links, My Trainer, theme, and account actions — collapse in here so the bar
 * only needs the logo, notifications bell, and this trigger. Slides in from the
 * right at ~90% width, full height. Reuses the app's portal + `data-modal-open`
 * scroll-lock convention (see Modal.tsx and globals.css).
 */
export function MobileNavDrawer({
  challengeSlug,
  showGm = false,
  myTrainerId = null,
  gmLensOn = false,
  className = "",
  children,
}: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [seenPath, setSeenPath] = useState(pathname);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on navigation. Adjusting state during render (rather than in an
  // effect) is the pattern this codebase uses for prop-derived resets.
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (open) setOpen(false);
  }

  const links: NavLink[] = [
    // TEMP: Seasons index hidden while only one season exists
    // { href: "/challenges", label: "Seasons", icon: <SeasonsIcon /> },
    { href: "/about", label: "About", icon: <AboutIcon /> },
  ];
  if (challengeSlug) {
    links.push({
      href: `/challenges/${challengeSlug}/rules`,
      label: "Rules / FAQ",
      icon: <RulesIcon />,
    });
  }
  if (challengeSlug && myTrainerId) {
    links.push({
      href: `/challenges/${challengeSlug}/me`,
      label: "My Trainer",
      icon: <MyTrainerIcon />,
    });
  }
  if (challengeSlug && showGm) {
    links.push({
      href: `/challenges/${challengeSlug}/gm`,
      label: "GM",
      icon: <GmIcon />,
    });
  }

  // While open: Esc closes, focus moves into the panel and returns to the
  // trigger on close, and crossing to the desktop breakpoint closes the drawer
  // so the body scroll-lock can't get stranded behind the hidden panel.
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);

    const desktop = window.matchMedia("(min-width: 640px)");
    const onDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", onDesktop);

    return () => {
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onDesktop);
      trigger?.focus();
    };
  }, [open]);

  // Lightweight focus trap: keep Tab within the panel.
  const onPanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={`pressable inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-frame bg-surface text-ink hover:border-interactive/50 ${className}`}
      >
        <MenuIcon />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              data-modal-open=""
              className="fixed inset-0 z-[100] sm:hidden"
            >
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="absolute inset-0 cursor-pointer bg-[var(--scrim)] backdrop-blur-[2px] motion-safe:animate-[drawer-scrim-in_200ms_ease-out]"
              />
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Site navigation"
                tabIndex={-1}
                onKeyDown={onPanelKeyDown}
                className="absolute inset-y-0 right-0 flex w-[90%] max-w-sm flex-col border-l border-frame bg-surface shadow-[0_0_40px_-4px_var(--shadow-md)] outline-none motion-safe:animate-[drawer-sheet-in_240ms_cubic-bezier(0.22,1,0.36,1)]"
              >
                <div className="flex items-center justify-between border-b border-frame px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Menu
                  </span>
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setOpen(false)}
                    className="pressable inline-flex h-9 w-9 items-center justify-center rounded-full border-interactive/35 bg-interactive-soft text-ink"
                  >
                    <CloseIcon />
                  </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
                  <nav className="flex flex-col gap-1">
                    {links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="flex h-11 items-center gap-3 rounded-md border border-transparent bg-surface px-3 text-sm font-medium hover:border-interactive/40 hover:bg-interactive-soft/60"
                      >
                        <span className="shrink-0 text-ink/70" aria-hidden>
                          {link.icon}
                        </span>
                        {link.label}
                      </Link>
                    ))}
                  </nav>

                  <div className="flex items-center justify-between rounded-md border border-frame bg-surface px-3 py-2">
                    <span className="text-sm font-medium">Jump</span>
                    <JumpTrigger
                      showShortcut={false}
                      onBeforeOpen={() => setOpen(false)}
                      className="h-8 border-interactive/35 bg-interactive-soft"
                    />
                  </div>

                  {showGm && challengeSlug ? (
                    <GmLensToggle
                      key={`gm-lens-drawer-${challengeSlug}-${gmLensOn ? "1" : "0"}`}
                      slug={challengeSlug}
                      initialOn={gmLensOn}
                      variant="drawer"
                    />
                  ) : null}

                  <div className="flex items-center justify-between rounded-md border border-frame bg-surface px-3 py-2">
                    <span className="text-sm font-medium">Theme</span>
                    <ThemeToggle />
                  </div>

                  {children}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <path d="M3 6h14M3 10h14M3 14h14" />
    </svg>
  );
}

function CloseIcon() {
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
