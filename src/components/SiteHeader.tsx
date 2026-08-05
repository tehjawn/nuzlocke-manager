import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { MyTrainerIcon, RulesIcon } from "@/components/nav-icons";
import {
  SiteHeaderGmChrome,
  SiteHeaderSession,
  SiteHeaderSessionFallback,
} from "@/components/SiteHeaderSession";
import { ToolsMenu } from "@/components/ToolsMenu";
import { JumpTrigger } from "@/features/jump";
import type { Challenge } from "@/lib/challenge-types";
import { getChallenge, getDefaultJumpChallenge } from "@/lib/challenges";

/** Shared shell width for the site header, footer, and page content. */
export const SITE_SHELL_MAX_CLASS = "max-w-7xl";

type SiteHeaderProps = {
  challengeSlug?: string;
  challengeYear?: number;
  /** Season display name for GM tools subtitle. */
  challengeName?: string | null;
  showGm?: boolean;
  myTrainerId?: string | null;
  /**
   * First-run funnel (#183): hide dense season pills so customize → Get Started
   * stays the focus. Does not affect mobile icon-only brand lockup.
   */
  firstRun?: boolean;
};

export async function SiteHeader({
  challengeSlug,
  challengeYear,
  challengeName = null,
  showGm = false,
  myTrainerId = null,
  firstRun = false,
}: SiteHeaderProps) {
  // Global pages omit season props — fall back to the live default. Only fetch
  // that default when both are absent so we never pair slug/year from different
  // seasons. If only one prop is set, resolve the other from that challenge.
  // These reads are `"use cache"` / static-friendly; request-time auth/GM work
  // lives in SiteHeaderSession under Suspense.
  let seasonSlug = challengeSlug ?? null;
  let seasonYear = challengeYear ?? null;
  let seasonName = challengeName ?? null;
  let seasonStatus: Challenge["status"] | null = null;

  if (seasonSlug == null && seasonYear == null) {
    const defaults = await getDefaultJumpChallenge();
    seasonSlug = defaults?.slug ?? null;
    seasonYear = defaults?.year ?? null;
    seasonStatus = defaults?.status ?? null;
    if (seasonName == null) seasonName = defaults?.name ?? null;
  } else if (seasonSlug != null && seasonYear == null) {
    const challenge = await getChallenge(seasonSlug);
    seasonYear = challenge?.year ?? null;
    seasonStatus = challenge?.status ?? null;
    if (seasonName == null) seasonName = challenge?.name ?? null;
  } else if (seasonSlug == null && seasonYear != null) {
    const defaults = await getDefaultJumpChallenge();
    if (defaults?.year === seasonYear) {
      seasonSlug = defaults.slug;
      seasonStatus = defaults.status;
      if (seasonName == null) seasonName = defaults.name ?? null;
    }
  } else if (seasonSlug != null && seasonName == null) {
    const challenge = await getChallenge(seasonSlug);
    seasonName = challenge?.name ?? null;
    seasonStatus = challenge?.status ?? null;
  }

  // Status is only needed for the global-page Jump GM registrar.
  if (!challengeSlug && seasonSlug != null && seasonStatus == null) {
    const challenge = await getChallenge(seasonSlug);
    seasonStatus = challenge?.status ?? null;
  }

  return (
    <>
      <header
        className={`relative z-40 mx-auto flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 ${SITE_SHELL_MAX_CLASS}`}
      >
        {/*
          Two-column brand lockup (sm+): icon | wordmark + season line.
          Season aligns with the wordmark, not the logo. Mobile stays icon-only.
        */}
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/" className="site-brand shrink-0" aria-label="Home">
            <Image
              src="/nuzlocke-mark.png"
              alt="Nuzlocke Manager"
              width={36}
              height={36}
              className="size-8 rounded-md sm:size-9"
              priority
            />
          </Link>
          <div className="hidden min-w-0 sm:block">
            <Link
              href="/"
              className="site-brand block truncate text-base font-bold tracking-tight sm:text-lg"
            >
              Nuzlocke Manager
            </Link>
            {seasonYear != null && seasonSlug ? (
              <p className="truncate text-sm text-muted">
                <Link
                  href={`/challenges/${seasonSlug}`}
                  className="hover:text-ink"
                >
                  Season {seasonYear} League
                </Link>
              </p>
            ) : null}
          </div>
        </div>
        <nav className="relative flex shrink-0 items-center gap-2 text-sm">
          <JumpTrigger />
          {/* Inline pills at sm+; below that they collapse into the drawer. */}
          <div className="hidden items-center gap-2 sm:flex">
            {/* TEMP: Seasons index + SeasonsIcon hidden while only one season exists
            <Link
              href="/challenges"
              className="pressable inline-flex h-9 items-center gap-2 border-frame bg-surface px-3.5 font-medium hover:border-interactive/50"
            >
              <SeasonsIcon className="h-4 w-4 text-ink/70" />
              Seasons
            </Link>
            */}
            {seasonSlug && !firstRun ? (
              <>
                <Link
                  href={`/challenges/${seasonSlug}/rules`}
                  className="pressable inline-flex h-9 items-center gap-2 border-frame bg-surface px-3.5 font-medium hover:border-interactive/50"
                >
                  <RulesIcon className="h-4 w-4 text-ink/70" />
                  Rules / FAQ
                </Link>
                <ToolsMenu slug={seasonSlug} />
              </>
            ) : null}
            {challengeSlug && myTrainerId ? (
              <Link
                href={`/challenges/${challengeSlug}/me`}
                className="pressable inline-flex h-9 items-center gap-2 border-accent/30 bg-accent px-3.5 font-semibold text-[var(--on-accent)]"
              >
                <MyTrainerIcon className="h-4 w-4" />
                My Trainer
              </Link>
            ) : null}
          </div>
          <Suspense
            fallback={
              <SiteHeaderSessionFallback
                hideMyTrainer={Boolean(myTrainerId)}
              />
            }
          >
            <SiteHeaderSession
              seasonSlug={seasonSlug}
              seasonYear={seasonYear}
              seasonName={seasonName}
              seasonStatus={seasonStatus}
              challengeSlug={challengeSlug}
              showGm={showGm}
              myTrainerId={myTrainerId}
              firstRun={firstRun}
            />
          </Suspense>
        </nav>
      </header>

      <Suspense fallback={null}>
        <SiteHeaderGmChrome
          challengeSlug={challengeSlug}
          challengeName={seasonName}
          showGm={showGm}
        />
      </Suspense>
    </>
  );
}
