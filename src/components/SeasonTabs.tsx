"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { ChallengeStatus } from "@/lib/challenge-types";

type SeasonTabsProps = {
  slug: string;
  status?: ChallengeStatus;
};

type Tab = {
  href: string;
  label: string;
  match: "exact" | "prefix";
  icon: ReactNode;
};

export function SeasonTabs({ slug, status = "ACTIVE" }: SeasonTabsProps) {
  const pathname = usePathname();
  const base = `/challenges/${slug}`;

  const tabs: Tab[] = [
    {
      href: base,
      label: "Players",
      match: "exact",
      icon: <PlayersIcon />,
    },
    {
      href: `${base}/setup`,
      label: "Get Started",
      match: "prefix",
      icon: <GetStartedIcon />,
    },
    {
      href: `${base}/rules`,
      label: "Rules",
      match: "prefix",
      icon: <RulesIcon />,
    },
    {
      href: `${base}/faq`,
      label: "FAQ",
      match: "prefix",
      icon: <FaqIcon />,
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

  return (
    <div
      role="tablist"
      aria-label="Season sections"
      className="gba-inset grid grid-cols-2 gap-1.5 bg-surface-2/80 p-1.5"
    >
      {tabs.map((tab) => {
        const active =
          tab.match === "exact"
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            prefetch
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-[calc(var(--radius-sm)-2px)] border px-2 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
              active
                ? "border-interactive/40 bg-interactive-soft text-ink shadow-sm"
                : "border-transparent text-ink hover:bg-surface"
            }`}
          >
            <span
              className={active ? "text-interactive" : "text-ink/70"}
              aria-hidden
            >
              {tab.icon}
            </span>
            {tab.label}
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

function GetStartedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M5 12h9" strokeLinecap="round" />
      <path d="M12 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 5v14" strokeLinecap="round" />
    </svg>
  );
}

function RulesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M6 4.5h9.5A2.5 2.5 0 0118 7v12.5H8A2 2 0 016 17.5v-13z" strokeLinejoin="round" />
      <path d="M9 9h6M9 12.5h6M9 16h4" strokeLinecap="round" />
    </svg>
  );
}

function FaqIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M9.75 9.5a2.25 2.25 0 114.1 1.3c-.5.7-1.35 1.05-1.85 1.7-.2.25-.25.5-.25.9" strokeLinecap="round" />
      <circle cx="12" cy="16.75" r="0.9" fill="currentColor" stroke="none" />
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
