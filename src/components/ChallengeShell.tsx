import Link from "next/link";
import type { ReactNode } from "react";
import { ActivityFeed } from "@/components/ActivityFeed";
import { DiscordIcon, DISCORD_BTN_CLASS } from "@/components/DiscordIcon";
import { Frame } from "@/components/Frame";
import { MobileWorkspace } from "@/components/MobileWorkspace";
import { ScrollFadeRail } from "@/components/ScrollFadeRail";
import { SeasonRulesLink } from "@/components/SeasonRulesLink";
import { SeasonTabs } from "@/components/SeasonTabs";
import { SiteHeader, SITE_SHELL_MAX_CLASS } from "@/components/SiteHeader";
import { GetStartedSeasonCta } from "@/components/GetStartedSeasonCta";
import type {
  ActivityItem,
  ChallengeStatus,
} from "@/lib/challenge-types";
import {
  seasonStatusChipClass,
  seasonStatusLabel,
} from "@/lib/season-status";

/** Fixed left rail width — keeps tab navigations from shifting columns. */
export const SEASON_LEFT_RAIL_CLASS = "w-full lg:w-[19.5rem] lg:shrink-0";

type ChallengeShellProps = {
  slug: string;
  name: string;
  year: number;
  game?: string | null;
  description: string;
  status?: ChallengeStatus;
  activities?: ActivityItem[];
  canReact?: boolean;
  showGm?: boolean;
  myTrainerId?: string | null;
  signedIn?: boolean;
  children: ReactNode;
};

export function ChallengeShell({
  slug,
  name,
  year,
  game,
  description,
  status = "ACTIVE",
  activities = [],
  canReact = false,
  showGm = false,
  myTrainerId = null,
  signedIn = false,
  children,
}: ChallengeShellProps) {
  // Shared between the mobile Info/Feed tabs and the desktop sticky rail.
  const generalInfo = (
    <Frame title="General info">
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs font-semibold tracking-tight text-muted">
            Season Status
          </dt>
          <dd className="mt-1">
            <span
              className={`inline-block rounded-lg px-2 py-0.5 text-xs font-semibold tracking-tight ${seasonStatusChipClass(status)}`}
            >
              {seasonStatusLabel(status)}
            </span>
          </dd>
        </div>
        <div>
          <dt className="sr-only">Season title</dt>
          <dd>
            <h1 className="text-2xl font-bold tracking-tight">
              {name}{" "}
              <span className="font-semibold text-muted">(Season {year})</span>
            </h1>
          </dd>
        </div>
        {game ? (
          <div>
            <dt className="text-xs font-semibold tracking-tight text-muted">
              Game
            </dt>
            <dd className="mt-0.5 font-medium">{game}</dd>
          </div>
        ) : null}
        <div>
          <dt className="sr-only">Description</dt>
          <dd className="leading-relaxed text-muted">{description}</dd>
        </div>
      </dl>
      <GetStartedSeasonCta slug={slug} />
      {!signedIn ? (
        <Link
          href="/login"
          className={`${DISCORD_BTN_CLASS} mt-3 px-3.5 py-2 text-sm`}
        >
          <DiscordIcon className="h-4 w-4" />
          Discord login
        </Link>
      ) : null}
    </Frame>
  );

  const packFeed = (
    <ActivityFeed
      slug={slug}
      activities={activities}
      canReact={canReact}
      previewCount={5}
    />
  );

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        challengeSlug={slug}
        challengeYear={year}
        showGm={showGm}
        myTrainerId={myTrainerId}
      />
      <div
        className={`mx-auto flex w-full flex-1 flex-col gap-6 px-4 pb-16 pt-2 sm:px-6 lg:flex-row lg:items-start ${SITE_SHELL_MAX_CLASS}`}
      >
        {/* Desktop: sticky left rail with info, section tabs, and the feed. */}
        <ScrollFadeRail
          className={`hidden ${SEASON_LEFT_RAIL_CLASS} lg:block lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start`}
          scrollClassName="lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-2 lg:[scrollbar-gutter:stable]"
        >
          {generalInfo}
          <SeasonTabs slug={slug} status={status} />
          <SeasonRulesLink slug={slug} />
          {packFeed}
        </ScrollFadeRail>

        {/*
          Mobile: section tabs plus Info/Feed tabs at the top. Selecting Info or
          Feed swaps the content area to that panel; section tabs navigate. On
          desktop this is just the page content column.
        */}
        <MobileWorkspace
          slug={slug}
          status={status}
          generalInfo={generalInfo}
          packFeed={packFeed}
          className="min-w-0 flex-1"
        >
          {children}
        </MobileWorkspace>
      </div>
    </div>
  );
}
