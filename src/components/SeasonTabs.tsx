"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { ChallengeStatus } from "@/lib/challenge-types";

type SeasonTabsProps = {
  slug: string;
  status?: ChallengeStatus;
};

export type SeasonTab = {
  href: string;
  label: string;
  match: "exact" | "prefix";
  icon: ReactNode;
};

/** Section-tab config, shared by the desktop rail and the mobile tab bar. */
export function getSeasonTabs(
  slug: string,
  status: ChallengeStatus = "ACTIVE",
): SeasonTab[] {
  const base = `/challenges/${slug}`;
  return [
    { href: base, label: "Trainers", match: "exact", icon: <PlayersIcon /> },
    {
      href: `${base}/encounters`,
      label: "Encounters",
      match: "prefix",
      icon: <EncountersIcon />,
    },
    {
      href: `${base}/tools`,
      label: "Tools",
      match: "prefix",
      icon: <ToolsIcon />,
    },
    {
      href: `${base}/memorial`,
      label: "Memorial",
      match: "prefix",
      icon: <MemorialIcon />,
    },
    {
      href: `${base}/tournament`,
      label: status === "TOURNAMENT" ? "Ladder" : "Tournament",
      match: "prefix",
      icon: <TournamentIcon />,
    },
  ];
}

export function isSeasonTabActive(tab: SeasonTab, pathname: string): boolean {
  return tab.match === "exact"
    ? pathname === tab.href
    : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function SeasonTabs({ slug, status = "ACTIVE" }: SeasonTabsProps) {
  const pathname = usePathname();
  const tabs = getSeasonTabs(slug, status);

  return (
    <div
      role="tablist"
      aria-label="Season sections"
      className="gba-inset flex flex-col gap-1 bg-surface-2/80 p-1.5"
    >
      {tabs.map((tab) => {
        const active = isSeasonTabActive(tab, pathname);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            prefetch
            data-tour={tab.label === "Trainers" ? "tab-trainers" : undefined}
            className={`flex items-center gap-3 rounded-[calc(var(--radius-sm)-2px)] border px-3 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "border-interactive/40 bg-interactive-soft text-ink shadow-sm"
                : "border-transparent text-ink hover:bg-surface"
            }`}
          >
            <span
              className={`shrink-0 ${active ? "text-interactive" : "text-ink/70"}`}
              aria-hidden
            >
              {tab.icon}
            </span>
            <span className="min-w-0">{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function PlayersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="9" cy="8" r="2.75" />
      <circle cx="16.5" cy="9" r="2.25" />
      <path d="M3.5 18.5c.9-2.6 2.8-4 5.5-4s4.6 1.4 5.5 4" strokeLinecap="round" />
      <path d="M14 18.5c.5-1.5 1.6-2.5 3.5-2.5 1.4 0 2.4.6 3 1.7" strokeLinecap="round" />
    </svg>
  );
}

function EncountersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 7h16M4 12h10M4 17h13" strokeLinecap="round" />
      <circle cx="18.5" cy="12" r="2.25" />
    </svg>
  );
}

function ToolsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M14.5 6.5l3 3-8.5 8.5H6v-3L14.5 6.5z" strokeLinejoin="round" />
      <path d="M12.5 8.5l3 3" strokeLinecap="round" />
      <circle cx="7.5" cy="7.5" r="2.25" />
      <path d="M16.5 16.5l2 2" strokeLinecap="round" />
    </svg>
  );
}

function MemorialIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M8 20V9.5a4 4 0 018 0V20" strokeLinecap="round" />
      <path d="M6 20h12" strokeLinecap="round" />
      <path d="M12 5.5V4" strokeLinecap="round" />
    </svg>
  );
}

function TournamentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M7 4h10v3a5 5 0 01-5 5 5 5 0 01-5-5V4z" strokeLinejoin="round" />
      <path d="M12 12v4" strokeLinecap="round" />
      <path d="M8 20h8" strokeLinecap="round" />
      <path d="M5 7H3.5A1.5 1.5 0 012 5.5V5" strokeLinecap="round" />
      <path d="M19 7h1.5A1.5 1.5 0 0022 5.5V5" strokeLinecap="round" />
    </svg>
  );
}
