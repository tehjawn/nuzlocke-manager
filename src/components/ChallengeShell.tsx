import Link from "next/link";
import type { ReactNode } from "react";
import { DiscordIcon, DISCORD_BTN_CLASS } from "@/components/DiscordIcon";
import { Frame } from "@/components/Frame";
import { MobileWorkspace } from "@/components/MobileWorkspace";
import { ScrollFadeRail } from "@/components/ScrollFadeRail";
import { SeasonTabs } from "@/components/SeasonTabs";
import { SiteHeader, SITE_SHELL_MAX_CLASS } from "@/components/SiteHeader";
import { GetStartedSeasonCta } from "@/components/GetStartedSeasonCta";
import type { ChallengeStatus } from "@/lib/challenge-types";
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
  showGm?: boolean;
  myTrainerId?: string | null;
  signedIn?: boolean;
  /**
   * First-run funnel (#183): show About / Rules / Trainers only and deep tools
   * so Get Started stays the focus.
   */
  firstRun?: boolean;
  /** Temporary WIP gate (#240): Tournament tab is GM-only. */
  isGm?: boolean;
  children: ReactNode;
};

export function ChallengeShell({
  slug,
  name,
  year,
  game,
  description,
  status = "ACTIVE",
  showGm = false,
  myTrainerId = null,
  signedIn = false,
  firstRun = false,
  isGm = false,
  children,
}: ChallengeShellProps) {
  // Shared between the mobile Info panel and the desktop sticky rail.
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
      {firstRun && myTrainerId ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Start here: finish{" "}
          <Link
            href={`/challenges/${slug}/me`}
            className="font-semibold text-accent-deep underline-offset-2 hover:underline"
          >
            creating your trainer
          </Link>
          , then follow Get Started through ROM setup and save import.
        </p>
      ) : null}
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

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        challengeSlug={slug}
        challengeYear={year}
        challengeName={name}
        showGm={showGm}
        myTrainerId={myTrainerId}
        firstRun={firstRun}
      />
      <div
        className={`mx-auto flex w-full flex-1 flex-col gap-6 px-4 pb-16 pt-2 sm:px-6 lg:flex-row lg:items-start ${SITE_SHELL_MAX_CLASS}`}
      >
        {/* Desktop: sticky left rail with info + section tabs. */}
        <ScrollFadeRail
          className={`hidden ${SEASON_LEFT_RAIL_CLASS} lg:block lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start`}
          scrollClassName="lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-2 lg:[scrollbar-gutter:stable]"
        >
          {generalInfo}
          <SeasonTabs
            slug={slug}
            status={status}
            firstRun={firstRun}
            isGm={isGm}
          />
        </ScrollFadeRail>

        {/*
          Mobile: section tabs plus an Info panel at the top. Selecting Info
          swaps the content area to that panel; section tabs navigate. On
          desktop this is just the page content column.
        */}
        <MobileWorkspace
          slug={slug}
          status={status}
          generalInfo={generalInfo}
          firstRun={firstRun}
          isGm={isGm}
          className="min-w-0 flex-1"
        >
          {children}
        </MobileWorkspace>
      </div>
    </div>
  );
}
