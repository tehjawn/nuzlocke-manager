import Link from "next/link";
import type { ReactNode } from "react";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Frame } from "@/components/Frame";
import { SeasonTabs } from "@/components/SeasonTabs";
import { SiteHeader } from "@/components/SiteHeader";
import type { ActivityItem } from "@/lib/challenge-types";

/** Fixed left rail width — keeps tab navigations from shifting columns. */
export const SEASON_LEFT_RAIL_CLASS = "w-full lg:w-[22.5rem] lg:shrink-0";

type ChallengeShellProps = {
  slug: string;
  name: string;
  year: number;
  game?: string | null;
  description: string;
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
          className={`${SEASON_LEFT_RAIL_CLASS} space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:self-start lg:pr-1`}
        >
          <Frame title={`Season ${year}`}>
            <p className="font-display text-xs font-bold tracking-[0.18em] text-accent-deep uppercase">
              General info
            </p>
            <h1 className="font-display mt-1 text-2xl font-extrabold tracking-tight">
              {name}
            </h1>
            {game ? <p className="mt-1 text-sm text-muted">{game}</p> : null}
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {description}
            </p>
            {!signedIn ? (
              <Link
                href="/login"
                className="pressable mt-4 inline-block rounded-sm bg-accent px-3 py-2 text-sm font-bold text-white"
              >
                Discord login
              </Link>
            ) : null}
          </Frame>

          <SeasonTabs slug={slug} />

          <ActivityFeed
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
