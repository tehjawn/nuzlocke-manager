import Link from "next/link";
import type { ReactNode } from "react";
import { ActivityFeed } from "@/components/ActivityFeed";
import { DiscordIcon } from "@/components/DiscordIcon";
import { Frame } from "@/components/Frame";
import { SeasonTabs } from "@/components/SeasonTabs";
import { SiteHeader } from "@/components/SiteHeader";
import { ShareSeasonLink } from "@/components/ShareSeasonLink";
import { TypeChartDrawer } from "@/components/TypeChartDrawer";
import { WelcomeSeasonCta } from "@/components/WelcomeSeasonCta";
import type {
  ActivityItem,
  ChallengeStatus,
  ChallengeVisibility,
} from "@/lib/challenge-types";
import { DEFAULT_CHALLENGE_SLUG } from "@/lib/constants-app";
import { seasonStatusLabel } from "@/lib/season-status";

/** Fixed left rail width — keeps tab navigations from shifting columns. */
export const SEASON_LEFT_RAIL_CLASS = "w-full lg:w-[22.5rem] lg:shrink-0";

type ChallengeShellProps = {
  slug: string;
  name: string;
  year: number;
  game?: string | null;
  description: string;
  status?: ChallengeStatus;
  visibility?: ChallengeVisibility;
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
  visibility = "INVITE",
  activities = [],
  canReact = false,
  showGm = false,
  myTrainerId = null,
  signedIn = false,
  children,
}: ChallengeShellProps) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        challengeSlug={slug}
        challengeYear={year}
        showGm={showGm}
        myTrainerId={myTrainerId}
      />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 pb-16 pt-2 sm:px-6 lg:flex-row lg:items-start">
        <aside
          className={`${SEASON_LEFT_RAIL_CLASS} space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:self-start lg:pr-2 lg:[scrollbar-gutter:stable]`}
        >
          <Frame title="General info">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-semibold tracking-tight text-muted">
                  Season Status
                </dt>
                <dd className="mt-1">
                  <span className="inline-block rounded-lg bg-accent-2/20 px-2 py-0.5 text-xs font-semibold tracking-tight text-accent-ink">
                    {seasonStatusLabel(status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="sr-only">Season title</dt>
                <dd>
                  <h1 className="text-2xl font-bold tracking-tight">
                    {name}{" "}
                    <span className="font-semibold text-muted">
                      (Season {year})
                    </span>
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
            {slug === DEFAULT_CHALLENGE_SLUG ? <WelcomeSeasonCta /> : null}
            <div className="mt-4">
              <ShareSeasonLink slug={slug} visibility={visibility} />
            </div>
            {!signedIn ? (
              <Link
                href="/login"
                className="pressable mt-3 inline-flex items-center gap-2 rounded-lg border-frame bg-surface px-3.5 py-2 text-sm font-semibold hover:border-interactive/50"
              >
                <DiscordIcon className="h-4 w-4" />
                Discord login
              </Link>
            ) : null}
          </Frame>

          <SeasonTabs slug={slug} status={status} />

          <TypeChartDrawer />

          <ActivityFeed
            slug={slug}
            activities={activities}
            canReact={canReact}
            previewCount={5}
          />
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
