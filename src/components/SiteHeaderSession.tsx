import { AuthButtons } from "@/components/AuthButtons";
import {
  GmToolsLauncher,
  GmViewBanner,
} from "@/components/GmToolsLauncher";
import { MobileMenuAuth } from "@/components/MobileMenuAuth";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import {
  SeasonJumpRegistrar,
  briefToJumpSeasonContext,
} from "@/features/jump";
import type { Challenge } from "@/lib/challenge-types";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { isGmForChallengeSlug } from "@/lib/permissions";

type SiteHeaderSessionProps = {
  seasonSlug: string | null;
  seasonYear: number | null;
  seasonName: string | null;
  seasonStatus: Challenge["status"] | null;
  challengeSlug?: string;
  showGm?: boolean;
  myTrainerId?: string | null;
};

/**
 * Request-time auth / GM membership chrome for the header nav.
 * Must render under <Suspense> so Cache Components can stream the shell.
 */
export async function SiteHeaderSession({
  seasonSlug,
  seasonYear,
  seasonName,
  seasonStatus,
  challengeSlug,
  showGm = false,
  myTrainerId = null,
}: SiteHeaderSessionProps) {
  const menuShowGm = showGm || (await isGmForChallengeSlug(seasonSlug));
  const feedbackHref = seasonSlug
    ? `/challenges/${seasonSlug}/feedback`
    : null;
  const gmHref =
    menuShowGm && seasonSlug ? `/challenges/${seasonSlug}/gm` : null;

  return (
    <>
      {/* Global pages have no season Jump registrar — keep GM Console in sync. */}
      {!challengeSlug &&
      seasonSlug &&
      seasonYear != null &&
      seasonStatus &&
      menuShowGm ? (
        <SeasonJumpRegistrar
          season={briefToJumpSeasonContext(
            {
              slug: seasonSlug,
              name: seasonName ?? seasonSlug,
              year: seasonYear,
              status: seasonStatus,
            },
            { showGm: true },
          )}
        />
      ) : null}
      <AuthButtons
        feedbackHref={feedbackHref}
        hideMyTrainer={Boolean(myTrainerId)}
        gmHref={gmHref}
      />
      <MobileNavDrawer
        className="sm:hidden"
        challengeSlug={seasonSlug ?? undefined}
        showGm={menuShowGm}
        myTrainerId={myTrainerId}
      >
        <MobileMenuAuth feedbackHref={feedbackHref} />
      </MobileNavDrawer>
    </>
  );
}

type SiteHeaderGmChromeProps = {
  challengeSlug?: string;
  challengeName?: string | null;
  showGm?: boolean;
};

/** Floating GM tools — cookie read stays behind the same Suspense pattern. */
export async function SiteHeaderGmChrome({
  challengeSlug,
  challengeName = null,
  showGm = false,
}: SiteHeaderGmChromeProps) {
  if (!showGm || !challengeSlug) return null;
  const gmViewOn = await readGmLensOn(challengeSlug);
  return (
    <>
      <GmViewBanner
        key={`gm-view-banner-${challengeSlug}`}
        slug={challengeSlug}
        initialOn={gmViewOn}
      />
      <GmToolsLauncher
        key={`gm-tools-${challengeSlug}`}
        slug={challengeSlug}
        seasonLabel={challengeName}
        initialOn={gmViewOn}
      />
    </>
  );
}

/** Compact placeholders so the header width stays stable while auth streams in. */
export function SiteHeaderSessionFallback({
  hideMyTrainer = false,
}: {
  hideMyTrainer?: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-2" aria-hidden>
        {!hideMyTrainer ? (
          <span className="hidden h-9 w-24 animate-pulse bg-surface sm:inline-block" />
        ) : null}
        <span className="inline-block h-9 w-9 animate-pulse bg-surface" />
        <span className="hidden h-9 w-28 animate-pulse bg-surface sm:inline-block" />
      </div>
      <span
        aria-hidden
        className="inline-block h-9 w-9 animate-pulse rounded-full bg-surface sm:hidden"
      />
    </>
  );
}
