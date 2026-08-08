"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AboutIcon,
  ActivityIcon,
  FaqIcon,
  GetStartedIcon,
  MyTrainerIcon,
  RulesIcon,
  ToolsIcon,
  TrainersIcon,
} from "@/components/nav-icons";
import { ToolChip } from "@/components/tool-icons";
import type { ChallengeStatus } from "@/lib/challenge-types";
import {
  TOOLS_CATALOG,
  parseToolsId,
  toolsHref,
  toolsHubHref,
} from "@/lib/tools-routes";

type SeasonTabsProps = {
  slug: string;
  status?: ChallengeStatus;
  firstRun?: boolean;
  /**
   * TEMP (#240): Tournament under Info → Get Started. Requires GM view (lens),
   * not merely the GAME_MASTER role.
   */
  gmViewOn?: boolean;
  /** When set, include My Trainer under the Trainers group. */
  myTrainerId?: string | null;
};

export type SeasonTab = {
  href: string;
  label: string;
  match: "exact" | "prefix";
  icon: ReactNode;
};

/** Flat section tabs for the mobile horizontal scroller. */
export function getSeasonTabs(
  slug: string,
  status: ChallengeStatus = "ACTIVE",
  options?: { firstRun?: boolean; gmViewOn?: boolean },
): SeasonTab[] {
  const base = `/challenges/${slug}`;
  const tabs: SeasonTab[] = [
    {
      href: `${base}/about`,
      label: "About",
      match: "prefix",
      icon: <AboutIcon />,
    },
    {
      href: `${base}/rules`,
      label: "Rules / FAQ",
      match: "prefix",
      icon: <RulesIcon />,
    },
    {
      href: base,
      label: "Trainers",
      match: "exact",
      icon: <TrainersIcon />,
    },
    {
      href: `${base}/tools`,
      label: "Tools",
      match: "prefix",
      icon: <ToolsIcon />,
    },
  ];

  // TEMP (#240): Tournament / Ladder is still WIP — GM view only.
  if (options?.gmViewOn) {
    tabs.push({
      href: `${base}/tournament`,
      label: status === "TOURNAMENT" ? "Ladder" : "Tournament",
      match: "prefix",
      icon: <TournamentIcon />,
    });
  }

  tabs.push({
    href: `${base}/activity`,
    label: "Activity",
    match: "prefix",
    icon: <ActivityIcon />,
  });

  // First-run (#183): keep orientation tabs; hide deep tools until welcome done.
  if (options?.firstRun) {
    return tabs.filter(
      (tab) =>
        tab.label === "About" ||
        tab.label === "Rules / FAQ" ||
        tab.label === "Trainers",
    );
  }
  return tabs;
}

export function isSeasonTabActive(tab: SeasonTab, pathname: string): boolean {
  return tab.match === "exact"
    ? pathname === tab.href
    : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

function under(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Desktop left-rail season nav. Mirrors the header Info / Tools / Trainers
 * disclosures as expandable groups, then season-only flat links.
 */
export function SeasonTabs({
  slug,
  status = "ACTIVE",
  firstRun = false,
  gmViewOn = false,
  myTrainerId = null,
}: SeasonTabsProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const base = `/challenges/${slug}`;

  const infoActive =
    under(pathname, `${base}/setup`) ||
    under(pathname, `${base}/about`) ||
    under(pathname, `${base}/rules`) ||
    under(pathname, `${base}/activity`) ||
    (gmViewOn && under(pathname, `${base}/tournament`));
  const toolsActive =
    under(pathname, `${base}/tools`) ||
    under(pathname, `${base}/season-stats`) ||
    under(pathname, `${base}/encounters`);
  const trainersActive =
    pathname === base ||
    under(pathname, `${base}/me`) ||
    under(pathname, `${base}/trainers`) ||
    under(pathname, `${base}/new-trainer`);

  const activeTool = under(pathname, `${base}/season-stats`)
    ? "stats"
    : under(pathname, `${base}/encounters`)
      ? "catch-map"
      : parseToolsId(searchParams.get("tool"), searchParams.get("tab"));

  return (
    <nav
      aria-label="Season sections"
      className="flex flex-col gap-1 rounded-[var(--radius)] border border-frame/70 bg-surface-2/70 p-1"
    >
      <NavGroup
        label="Info"
        icon={<AboutIcon className="h-4 w-4" />}
        initialOpen={infoActive}
        sectionActive={infoActive}
      >
        <NavChild
          href={`${base}/setup`}
          label="Get Started"
          icon={<GetStartedIcon className="h-3.5 w-3.5" />}
          active={under(pathname, `${base}/setup`)}
        />
        {gmViewOn && (
          <NavChild
            href={`${base}/tournament`}
            label={status === "TOURNAMENT" ? "Ladder" : "Tournament"}
            icon={<TournamentIcon />}
            active={under(pathname, `${base}/tournament`)}
          />
        )}
        <NavChild
          href={`${base}/about`}
          label="About"
          icon={<AboutIcon className="h-3.5 w-3.5" />}
          active={under(pathname, `${base}/about`)}
        />
        <NavChild
          href={`${base}/rules`}
          label="Rules"
          icon={<RulesIcon className="h-3.5 w-3.5" />}
          active={
            under(pathname, `${base}/rules`) &&
            searchParams.get("tab") !== "faq"
          }
        />
        <NavChild
          href={`${base}/rules?tab=faq`}
          label="FAQ"
          icon={<FaqIcon className="h-3.5 w-3.5" />}
          active={
            under(pathname, `${base}/rules`) &&
            searchParams.get("tab") === "faq"
          }
        />
        {!firstRun && (
          <NavChild
            href={`${base}/activity`}
            label="Activity"
            icon={<ActivityIcon className="h-3.5 w-3.5" />}
            active={under(pathname, `${base}/activity`)}
          />
        )}
      </NavGroup>

      {!firstRun && (
        <NavGroup
          label="Tools"
          icon={<ToolsIcon className="h-4 w-4" />}
          initialOpen={toolsActive}
          sectionActive={toolsActive}
        >
          {TOOLS_CATALOG.map((tool) => (
            <NavChild
              key={tool.id}
              href={toolsHref(slug, tool.id)}
              label={tool.title}
              icon={
                <ToolChip
                  id={tool.id}
                  className="h-5 w-5"
                  iconClassName="h-3 w-3"
                />
              }
              active={activeTool === tool.id}
              dense
            />
          ))}
          <NavChild
            href={toolsHubHref(slug)}
            label="All tools"
            active={under(pathname, `${base}/tools`) && activeTool == null}
            muted
          />
        </NavGroup>
      )}

      <NavGroup
        label="Trainers"
        icon={<TrainersIcon className="h-4 w-4" />}
        initialOpen={trainersActive}
        sectionActive={trainersActive}
        dataTour="tab-trainers"
      >
        <NavChild
          href={base}
          label="All Trainers"
          icon={<TrainersIcon className="h-3.5 w-3.5" />}
          active={pathname === base}
        />
        {myTrainerId && (
          <NavChild
            href={`${base}/me`}
            label="My Trainer"
            icon={<MyTrainerIcon className="h-3.5 w-3.5" />}
            active={under(pathname, `${base}/me`)}
          />
        )}
      </NavGroup>

    </nav>
  );
}

function NavGroup({
  label,
  icon,
  initialOpen,
  sectionActive,
  dataTour,
  children,
}: {
  label: string;
  icon: ReactNode;
  initialOpen: boolean;
  sectionActive: boolean;
  dataTour?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initialOpen);
  const listId = useId();

  // Path-driven open: expand only while this group's route is active;
  // collapse when navigating away (manual toggle still works in-place).
  const [seenActive, setSeenActive] = useState(sectionActive);
  if (sectionActive !== seenActive) {
    setSeenActive(sectionActive);
    setOpen(sectionActive);
  }

  const emphasized = sectionActive || open;

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        data-tour={dataTour}
        className={`flex w-full items-center gap-2 rounded-[calc(var(--radius-sm)-2px)] px-2 py-1.5 text-left text-sm font-semibold transition-colors ${
          emphasized ? "bg-surface text-ink" : "text-ink hover:bg-surface/80"
        }`}
      >
        <span
          className={`shrink-0 ${emphasized ? "text-ink" : "text-ink/70"}`}
          aria-hidden
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronIcon
          open={open}
          className={emphasized ? "text-ink/70" : "text-muted"}
        />
      </button>
      {open && (
        <ul
          id={listId}
          className="ml-2.5 flex flex-col gap-0.5 border-l border-frame/55 py-0.5 pl-1.5"
        >
          {children}
        </ul>
      )}
    </div>
  );
}

function NavChild({
  href,
  label,
  icon,
  active,
  muted = false,
  dense = false,
}: {
  href: string;
  label: string;
  icon?: ReactNode;
  active: boolean;
  muted?: boolean;
  dense?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        prefetch={false}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2 rounded-[calc(var(--radius-sm)-2px)] px-2 text-sm font-medium transition-colors ${
          dense ? "py-1" : "py-1.5"
        } ${
          active
            ? "bg-surface text-ink"
            : muted
              ? "text-muted hover:bg-surface hover:text-ink"
              : "text-ink hover:bg-surface"
        }`}
      >
        {icon && (
          <span
            className={`shrink-0 ${active ? "text-ink" : "text-ink/65"}`}
            aria-hidden
          >
            {icon}
          </span>
        )}
        <span className="min-w-0 truncate">{label}</span>
      </Link>
    </li>
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
      className={`h-3 w-3 shrink-0 transition-transform ${className} ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TournamentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M7 4h10v3a5 5 0 01-5 5 5 5 0 01-5-5V4z" strokeLinejoin="round" />
      <path d="M12 12v4" strokeLinecap="round" />
      <path d="M8 20h8" strokeLinecap="round" />
      <path d="M5 7H3.5A1.5 1.5 0 012 5.5V5" strokeLinecap="round" />
      <path d="M19 7h1.5A1.5 1.5 0 0022 5.5V5" strokeLinecap="round" />
    </svg>
  );
}
