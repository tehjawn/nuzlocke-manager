"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ChallengeStatus } from "@/lib/challenge-types";
import { getSeasonTabs, isSeasonTabActive } from "@/components/SeasonTabs";
import {
  ONBOARDING_PANEL_EVENT,
  type OnboardingMobilePanel,
} from "@/lib/onboarding";

type MobileWorkspaceProps = {
  slug: string;
  status?: ChallengeStatus;
  /** Shown when the "Info" tab is selected. */
  generalInfo: ReactNode;
  /** Shown when the "Feed" tab is selected. */
  packFeed: ReactNode;
  /** The routed page content, shown when a section tab is selected. */
  children: ReactNode;
  className?: string;
};

const itemBase =
  "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[calc(var(--radius-sm)-2px)] border px-3 py-2.5 text-sm font-semibold transition-colors";
const itemActive = "border-interactive/40 bg-interactive-soft text-ink shadow-sm";
const itemIdle = "border-transparent text-ink hover:bg-surface";

/**
 * Mobile workspace shell. The section tabs (Trainers, Encounters, …) sit in one
 * horizontal scroller alongside "Info" and "Feed" tabs. Info/Feed aren't routes
 * — selecting one swaps the whole content area to that panel and hides the page
 * content; the section tabs are real links that navigate. Desktop instead uses
 * the sticky left rail (this component just renders the page content there).
 */
export function MobileWorkspace({
  slug,
  status = "ACTIVE",
  generalInfo,
  packFeed,
  children,
  className = "",
}: MobileWorkspaceProps) {
  const pathname = usePathname() ?? "";
  const [panel, setPanel] = useState<"info" | "feed" | null>(null);
  const [seenPath, setSeenPath] = useState(pathname);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [fadeStart, setFadeStart] = useState(false);
  const [fadeEnd, setFadeEnd] = useState(false);

  // Navigating to a section clears any Info/Feed selection.
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (panel !== null) setPanel(null);
  }

  const tabs = getSeasonTabs(slug, status);
  const select = (next: "info" | "feed") =>
    setPanel((cur) => (cur === next ? null : next));

  // Handle link clicks inside this shell (panel CTAs and section tabs).
  // - Same-page link (e.g. "Get Started" while already on /setup): no navigation
  //   fires, so close the panel now to reveal the destination.
  // - Cross-page link: keep the panel open until the new route commits — the
  //   pathname-change reset above closes it exactly when the new content lands,
  //   so we never flash the outgoing page underneath mid-navigation.
  const onLinkClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (panel === null) return;
    const anchor = (e.target as HTMLElement).closest("a");
    const href = anchor?.getAttribute("href");
    if (!href) return;
    try {
      if (new URL(href, window.location.origin).pathname === pathname) {
        setPanel(null);
      }
    } catch {
      setPanel(null);
    }
  };

  // Edge fades that hint at more tabs off-screen.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      setFadeStart(el.scrollLeft > 2);
      setFadeEnd(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  // First-run tour: open/close Info/Feed so spotlight steps can find mobile
  // targets that only exist inside those panels (e.g. Get Started).
  useEffect(() => {
    const onPanel = (event: Event) => {
      const detail = (event as CustomEvent<{ panel?: OnboardingMobilePanel }>)
        .detail;
      if (!detail || !("panel" in detail)) return;
      setPanel(detail.panel ?? null);
    };
    window.addEventListener(ONBOARDING_PANEL_EVENT, onPanel);
    return () => window.removeEventListener(ONBOARDING_PANEL_EVENT, onPanel);
  }, []);

  return (
    <div className={className} onClick={onLinkClick}>
      {/* Mobile section nav */}
      <div className="relative mb-4 lg:hidden">
        <div
          ref={scrollerRef}
          aria-label="Season sections"
          className="gba-inset flex flex-row gap-1 overflow-x-auto bg-surface-2/80 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            aria-pressed={panel === "info"}
            onClick={() => select("info")}
            data-tour="tab-info"
            className={`${itemBase} ${panel === "info" ? itemActive : itemIdle}`}
          >
            <span
              className={`shrink-0 ${panel === "info" ? "text-interactive" : "text-ink/70"}`}
              aria-hidden
            >
              <InfoIcon />
            </span>
            Info
          </button>
          <button
            type="button"
            aria-pressed={panel === "feed"}
            onClick={() => select("feed")}
            data-tour="tab-feed"
            className={`${itemBase} ${panel === "feed" ? itemActive : itemIdle}`}
          >
            <span
              className={`shrink-0 ${panel === "feed" ? "text-interactive" : "text-ink/70"}`}
              aria-hidden
            >
              <FeedIcon />
            </span>
            Feed
          </button>

          <span aria-hidden className="my-1 w-px shrink-0 bg-frame/60" />

          {tabs.map((tab) => {
            const active = panel === null && isSeasonTabActive(tab, pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch
                aria-current={active ? "page" : undefined}
                data-tour={
                  tab.label === "Trainers" ? "tab-trainers" : undefined
                }
                className={`${itemBase} ${active ? itemActive : itemIdle}`}
              >
                <span
                  className={`shrink-0 ${active ? "text-interactive" : "text-ink/70"}`}
                  aria-hidden
                >
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            );
          })}
        </div>
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-px left-px w-10 rounded-l-[var(--radius-sm)] bg-gradient-to-r from-[var(--surface-2)] to-transparent transition-opacity duration-200 ${
            fadeStart ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-px right-px w-10 rounded-r-[var(--radius-sm)] bg-gradient-to-l from-[var(--surface-2)] to-transparent transition-opacity duration-200 ${
            fadeEnd ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      {/* Info/Feed panels replace the page content on mobile. */}
      {panel === "info" ? <div className="lg:hidden">{generalInfo}</div> : null}
      {panel === "feed" ? <div className="lg:hidden">{packFeed}</div> : null}

      {/* Page content: hidden on mobile while a panel is open; always on desktop. */}
      <div className={panel !== null ? "hidden lg:block" : undefined}>
        {children}
      </div>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" strokeLinecap="round" />
      <path d="M12 7.75v.5" strokeLinecap="round" />
    </svg>
  );
}

function FeedIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
    </svg>
  );
}
