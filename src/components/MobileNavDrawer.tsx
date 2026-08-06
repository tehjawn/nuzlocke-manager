"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AboutIcon,
  FaqIcon,
  GmIcon,
  MyTrainerIcon,
  RulesIcon,
  ToolsIcon,
  TrainersIcon,
} from "@/components/nav-icons";
import { ToolChip } from "@/components/tool-icons";
import { SearchTrigger } from "@/features/search";
import {
  TOOLS_CATALOG,
  toolsHref,
  toolsHubHref,
} from "@/lib/tools-routes";

type NavRow =
  | { kind: "link"; key: string; href: string; label: string; icon: ReactNode }
  | { kind: "info"; key: string; slug: string }
  | { kind: "trainers"; key: string; slug: string; myTrainerId: string | null }
  | { kind: "tools"; key: string; slug: string };

type MobileNavDrawerProps = {
  challengeSlug?: string;
  showGm?: boolean;
  myTrainerId?: string | null;
  /** First-run funnel (#183): hide Rules / Tools. */
  firstRun?: boolean;
  /** Applied to the trigger button (e.g. `sm:hidden`). */
  className?: string;
  /** Account actions (server-rendered): My Profile + Sign Out, or Discord login. */
  children?: ReactNode;
};

/**
 * Hamburger-triggered navigation sheet for narrow viewports. The site header
 * keeps its inline pill row at `sm+`; below that header controls — nav links,
 * Trainers, and account actions — collapse in here so the bar only needs the
 * logo, notifications bell, and this trigger. Theme lives in the site footer.
 * Slides in from the right at ~90% width, full height. Reuses the app's portal
 * + `data-modal-open` scroll-lock convention (see Modal.tsx and globals.css).
 */
export function MobileNavDrawer({
  challengeSlug,
  showGm = false,
  myTrainerId = null,
  firstRun = false,
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

  // TEMP: Seasons index hidden while only one season exists
  // { href: "/challenges", label: "Seasons", icon: <SeasonsIcon /> },
  const rows: NavRow[] = [];
  if (challengeSlug && !firstRun) {
    rows.push(
      { kind: "info", key: "info", slug: challengeSlug },
      {
        kind: "trainers",
        key: "trainers",
        slug: challengeSlug,
        myTrainerId,
      },
      { kind: "tools", key: "tools", slug: challengeSlug },
    );
  } else if (challengeSlug && myTrainerId) {
    // First-run + joined: keep Trainers reachable (old My Trainer pill gate).
    rows.push({
      kind: "trainers",
      key: "trainers",
      slug: challengeSlug,
      myTrainerId,
    });
  }
  if (challengeSlug && showGm) {
    rows.push({
      kind: "link",
      key: "gm",
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
                    {rows.map((row) => {
                      if (row.kind === "info") {
                        return (
                          <InfoNavSection
                            key={row.key}
                            slug={row.slug}
                            initialOpen={isUnder(
                              pathname,
                              `/challenges/${row.slug}/about`,
                            ) || isUnder(pathname, `/challenges/${row.slug}/rules`)}
                            onNavigate={() => setOpen(false)}
                          />
                        );
                      }
                      if (row.kind === "trainers") {
                        const boardHref = `/challenges/${row.slug}`;
                        const meHref = `${boardHref}/me`;
                        return (
                          <TrainersNavSection
                            key={row.key}
                            slug={row.slug}
                            myTrainerId={row.myTrainerId}
                            initialOpen={
                              pathname === boardHref ||
                              isUnder(pathname, meHref)
                            }
                            onNavigate={() => setOpen(false)}
                          />
                        );
                      }
                      if (row.kind === "tools") {
                        return (
                          <ToolsNavSection
                            key={row.key}
                            slug={row.slug}
                            initialOpen={isUnder(
                              pathname,
                              toolsHubHref(row.slug),
                            )}
                            onNavigate={() => setOpen(false)}
                          />
                        );
                      }
                      return (
                        <Link
                          key={row.key}
                          href={row.href}
                          onClick={() => setOpen(false)}
                          className={NAV_ROW_CLASS}
                        >
                          <span className="shrink-0 text-ink/70" aria-hidden>
                            {row.icon}
                          </span>
                          {row.label}
                        </Link>
                      );
                    })}
                  </nav>

                  <div className="flex items-center justify-between rounded-md border border-frame bg-surface px-3 py-2">
                    <span className="text-sm font-medium">Search</span>
                    <SearchTrigger
                      showShortcut={false}
                      onBeforeOpen={() => setOpen(false)}
                      className="h-8 min-w-0 border-interactive/35 bg-interactive-soft text-ink"
                    />
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

const NAV_ROW_CLASS =
  "flex h-11 items-center gap-3 rounded-md border border-transparent bg-surface px-3 text-sm font-medium hover:border-interactive/40 hover:bg-interactive-soft/60";

const NESTED_LINK_CLASS =
  "flex items-center gap-2.5 rounded-md border border-transparent px-2.5 py-2 hover:border-interactive/40 hover:bg-interactive-soft/60";

/** Same prefix rule the season rail uses for active tabs (`SeasonTabs`). */
function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function InfoNavSection({
  slug,
  initialOpen,
  onNavigate,
}: {
  slug: string;
  initialOpen: boolean;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  const listId = useId();
  const base = `/challenges/${slug}`;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={`${NAV_ROW_CLASS} w-full text-left`}
      >
        <span className="shrink-0 text-ink/70" aria-hidden>
          <AboutIcon />
        </span>
        <span className="flex-1">Info</span>
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <ul id={listId} className="ml-5 flex flex-col gap-1 border-l border-frame/60 pl-2">
          <li>
            <Link href={`${base}/about`} onClick={onNavigate} className={NESTED_LINK_CLASS}>
              <span className="shrink-0 text-ink/70" aria-hidden>
                <AboutIcon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">About</span>
            </Link>
          </li>
          <li>
            <Link href={`${base}/rules`} onClick={onNavigate} className={NESTED_LINK_CLASS}>
              <span className="shrink-0 text-ink/70" aria-hidden>
                <RulesIcon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">Rules</span>
            </Link>
          </li>
          <li>
            <Link
              href={`${base}/rules?tab=faq`}
              onClick={onNavigate}
              className={NESTED_LINK_CLASS}
            >
              <span className="shrink-0 text-ink/70" aria-hidden>
                <FaqIcon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">FAQ</span>
            </Link>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

function TrainersNavSection({
  slug,
  myTrainerId,
  initialOpen,
  onNavigate,
}: {
  slug: string;
  myTrainerId: string | null;
  initialOpen: boolean;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  const listId = useId();
  const base = `/challenges/${slug}`;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={`${NAV_ROW_CLASS} w-full text-left`}
      >
        <span className="shrink-0 text-ink/70" aria-hidden>
          <TrainersIcon />
        </span>
        <span className="flex-1">Trainers</span>
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <ul id={listId} className="ml-5 flex flex-col gap-1 border-l border-frame/60 pl-2">
          <li>
            <Link href={base} onClick={onNavigate} className={NESTED_LINK_CLASS}>
              <span className="shrink-0 text-ink/70" aria-hidden>
                <TrainersIcon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">All Trainers</span>
            </Link>
          </li>
          {myTrainerId ? (
            <li>
              <Link
                href={`${base}/me`}
                onClick={onNavigate}
                className={`${NESTED_LINK_CLASS} border-accent/25 bg-accent/12 font-semibold text-accent-deep hover:bg-accent/20`}
              >
                <span className="shrink-0 text-accent-deep" aria-hidden>
                  <MyTrainerIcon className="h-4 w-4" />
                </span>
                <span className="text-sm">My Trainer</span>
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Tools as an expanding row rather than five flat ones (#253) — the drawer also
 * carries Info, Trainers, GM, Search, and the account actions, and inlining
 * the whole catalog would bury them. Renders off `TOOLS_CATALOG` so it tracks
 * the header menu without a second list to maintain. Season Stats is included
 * as a deep link to the Season Stats season tab (#288).
 */
function ToolsNavSection({
  slug,
  initialOpen,
  onNavigate,
}: {
  slug: string;
  initialOpen: boolean;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  const listId = useId();

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={`${NAV_ROW_CLASS} w-full text-left`}
      >
        <span className="shrink-0 text-ink/70" aria-hidden>
          <ToolsIcon />
        </span>
        <span className="flex-1">Tools</span>
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <ul id={listId} className="ml-5 flex flex-col gap-1 border-l border-frame/60 pl-2">
          {TOOLS_CATALOG.map((tool) => (
            <li key={tool.id}>
              <Link
                href={toolsHref(slug, tool.id)}
                onClick={onNavigate}
                className="flex items-center gap-2.5 rounded-md border border-transparent px-2.5 py-2 hover:border-interactive/40 hover:bg-interactive-soft/60"
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
            </li>
          ))}
          <li>
            <Link
              href={toolsHubHref(slug)}
              onClick={onNavigate}
              className="flex items-center justify-between gap-3 rounded-md border border-transparent px-2.5 py-2 text-xs font-medium text-muted hover:border-frame hover:bg-surface-2 hover:text-ink"
            >
              All tools
              <span aria-hidden className="text-muted/80">
                →
              </span>
            </Link>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
