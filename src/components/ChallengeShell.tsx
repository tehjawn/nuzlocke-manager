import Link from "next/link";
import type { ReactNode } from "react";
import { ActivityFeed } from "@/components/ActivityFeed";
import { DiscordIcon } from "@/components/DiscordIcon";
import { Frame } from "@/components/Frame";
import { SeasonTabs } from "@/components/SeasonTabs";
import { SiteHeader } from "@/components/SiteHeader";
import type { ActivityItem, ChallengeStatus } from "@/lib/challenge-types";
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
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        challengeSlug={slug}
        challengeName={name}
        showGm={showGm}
        myTrainerId={myTrainerId}
        wide
      />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 pb-16 pt-2 sm:px-6 lg:flex-row lg:items-start">
        <aside
          className={`${SEASON_LEFT_RAIL_CLASS} space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:self-start lg:pr-2 lg:[scrollbar-gutter:stable]`}
        >
          <Frame title={`Season ${year}`}>
            <p className="text-xs font-semibold tracking-tight text-accent-deep">
              General info · {seasonStatusLabel(status)}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {name}
            </h1>
            {game ? <p className="mt-1 text-sm text-muted">{game}</p> : null}
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {description}
            </p>
            {!signedIn ? (
              <Link
                href="/login"
                className="pressable mt-4 inline-flex items-center gap-2 rounded-lg border-accent/40 bg-accent px-3.5 py-2 text-sm font-semibold text-[var(--on-accent)]"
              >
                <DiscordIcon className="h-4 w-4" />
                Discord login
              </Link>
            ) : null}
          </Frame>

          <SeasonTabs slug={slug} status={status} />

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
