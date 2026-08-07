import { auth } from "@/auth";
import { AuthButtons } from "@/components/AuthButtons";
import { GmToolsLauncher, GmViewBanner } from "@/components/GmToolsLauncher";
import { MobileMenuAuth } from "@/components/MobileMenuAuth";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import { TrainersMenu } from "@/components/TrainersMenu";
import {
  SeasonSearchRegistrar,
  briefToSearchSeasonContext,
} from "@/features/search";
import type { Challenge } from "@/lib/challenge-types";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { isGmForChallengeSlug } from "@/lib/permissions";

type SiteHeaderSessionProps = {
  seasonSlug: string | null;
  seasonYear: number | null;
  seasonName: string | null;
  seasonStatus: Challenge["status"] | null;
  seasonGame?: string | null;
  challengeSlug?: string;
  showGm?: boolean;
  myTrainerId?: string | null;
  firstRun?: boolean;
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
  seasonGame = null,
  challengeSlug,
  showGm = false,
  myTrainerId = null,
  firstRun = false,
}: SiteHeaderSessionProps) {
  const menuShowGm =
    !firstRun && (showGm || (await isGmForChallengeSlug(seasonSlug)));
  const feedbackHref = seasonSlug ? `/challenges/${seasonSlug}/feedback` : null;
  const gmHref =
    menuShowGm && seasonSlug ? `/challenges/${seasonSlug}/gm` : null;
  /*
    My Trainer is a signed-in destination (`/me` auto-joins), so the row is gated
    on the session rather than on `myTrainerId` — global pages never resolve that
    prop, which is exactly why a standalone pill used to appear beside a Trainers
    menu that was missing the row.
  */
  const signedIn = Boolean((await auth())?.user);
  const showTrainersMenu =
    Boolean(seasonSlug) && (Boolean(myTrainerId) || !firstRun);

  return (
    <>
      {/* Global pages have no season Search registrar — keep GM Console in sync. */}
      {!challengeSlug &&
        seasonSlug &&
        seasonYear != null &&
        seasonStatus &&
        menuShowGm && (
          <SeasonSearchRegistrar
            season={briefToSearchSeasonContext(
              {
                slug: seasonSlug,
                name: seasonName ?? seasonSlug,
                year: seasonYear,
                status: seasonStatus,
                game: seasonGame,
              },
              { showGm: true },
            )}
          />
        )}
      {showTrainersMenu && seasonSlug && (
        <TrainersMenu
          slug={seasonSlug}
          showMyTrainer={signedIn}
          className="hidden sm:block"
        />
      )}
      <AuthButtons feedbackHref={feedbackHref} gmHref={gmHref} />
      <MobileNavDrawer
        className="sm:hidden"
        challengeSlug={seasonSlug ?? undefined}
        showGm={menuShowGm}
        myTrainerId={myTrainerId}
        showMyTrainer={signedIn}
        firstRun={firstRun}
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
  showTrainers = false,
}: {
  /** Reserve the Trainers pill — it streams in with the session now. */
  showTrainers?: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-2" aria-hidden>
        {showTrainers && (
          <span className="hidden h-9 w-28 animate-pulse bg-surface sm:inline-block" />
        )}
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
