import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Frame } from "@/components/Frame";
import { GameModeSettingsGuide } from "@/components/GameModeSettingsGuide";
import { WelcomeVideoPanel } from "@/components/WelcomeVideoPanel";
import { getChallenge } from "@/lib/challenges";
import { CTA_PRIMARY } from "@/lib/cta";
import { readGmLensOn } from "@/lib/gm-lens.server";
import { getAccessForChallenge } from "@/lib/permissions";
import {
  canViewWelcomeVideo,
  formatWelcomeVideoPublishAtEastern,
  resolveSeasonRomUrl,
  resolveSeasonWelcomeVideoUrl,
  resolveWelcomeVideoEmbed,
} from "@/lib/welcome-video";

export const dynamic = "force-dynamic";

const AFTERPLAY_URL = "https://afterplay.io";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const challenge = await getChallenge(slug);
  return { title: challenge ? `Get Started · ${challenge.name}` : "Get Started" };
}

export default async function SetupPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  const challenge = await getChallenge(slug, session?.user?.id);
  if (!challenge) notFound();

  const access = challenge.id
    ? await getAccessForChallenge(challenge.id)
    : null;
  // GM role or GM view lens — always preview the welcome video early.
  const gmPreview =
    Boolean(access?.isGm) || (await readGmLensOn(slug));
  const welcomeUrl = resolveSeasonWelcomeVideoUrl(challenge.welcomeVideoUrl);
  const romUrl = resolveSeasonRomUrl(challenge.romUrl);
  const welcomeUnlocked = canViewWelcomeVideo(
    gmPreview,
    challenge.welcomeVideoPublishAt,
  );
  const welcomeEmbed = welcomeUnlocked
    ? resolveWelcomeVideoEmbed(welcomeUrl)
    : null;
  const welcomeLockedMessage = !welcomeUnlocked
    ? welcomeUrl
      ? `Unlocks for everyone at ${formatWelcomeVideoPublishAtEastern(challenge.welcomeVideoPublishAt)}. GMs can change this in the GM console.`
      : null
    : !welcomeUrl && gmPreview
      ? "No welcome video URL configured yet — add one under Season settings in the GM console."
      : null;

  const trainerHref = `/challenges/${challenge.slug}/me`;

  return (
    <>
      <header className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">
          Get Started
        </h2>
        <p className="mt-2 text-muted">
          Download the ROM, load it in Afterplay (or another emulator), confirm
          Game Mode settings, export your save, then import it on your trainer
          board.
        </p>
      </header>

      <div className="mb-4">
        <Frame data-tour="setup-welcome" title="Welcome">
          <p className="mb-4 text-sm leading-relaxed text-muted">
            A message from Jason (@Oubori) to kick off Season 2026 — then follow
            the steps below to get your run online.
          </p>
          <WelcomeVideoPanel
            embed={welcomeEmbed}
            lockedMessage={welcomeLockedMessage}
            fallbackUrl={welcomeUnlocked ? welcomeUrl : null}
          />
        </Frame>
      </div>

      <ol className="space-y-4">
        <li>
          <Frame title="1. Download the ROM">
            <p className="text-sm leading-relaxed text-muted">
              Grab the Trash Pack ROM from Google Drive. This build is already
              set up for the season (including Gen&nbsp;1–3 + extras, totaling
              423 Pokémon).
            </p>
            <a
              href={romUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${CTA_PRIMARY} mt-4`}
            >
              Download ROM →
            </a>
          </Frame>
        </li>

        <li>
          <Frame title="2. Load the ROM in Afterplay">
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
              <li>
                Sign up / log in at{" "}
                <a
                  href={AFTERPLAY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-accent-deep underline-offset-2 hover:underline"
                >
                  afterplay.io
                </a>
                .
              </li>
              <li>
                Add a Game Boy Advance game and upload the ROM you downloaded.
              </li>
              <li>
                Open the game from your Afterplay library when you&apos;re ready
                to play.
              </li>
            </ol>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Afterplay is recommended for ease of use (browser play + cloud
              saves), but you can use another emulator instead — for example{" "}
              <span className="font-semibold text-ink">mGBA</span> (PC/Mac),{" "}
              <span className="font-semibold text-ink">Delta</span> (iOS), or{" "}
              <span className="font-semibold text-ink">My Boy!</span> (Android).
              Just make sure you can export a Gen&nbsp;3{" "}
              <code className="rounded-lg bg-surface-2 px-1">.sav</code> /{" "}
              <code className="rounded-lg bg-surface-2 px-1">.srm</code> for
              import in step 4.
            </p>
            <a
              href={AFTERPLAY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${CTA_PRIMARY} mt-4`}
            >
              Open Afterplay →
            </a>
          </Frame>
        </li>

        <li>
          <Frame title="3. Match season Game Mode settings">
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-muted">
                When you boot the ROM, work through the Game Mode menus in order
                and match the Pokémon Emerald Modern season defaults below.
                Don&apos;t swap to a different patch mid-season. Core run rules
                (faint = dead, first encounter only, nicknames required) live
                on{" "}
                <Link
                  href={`/challenges/${challenge.slug}/rules`}
                  className="font-bold text-accent-deep underline-offset-2 hover:underline"
                >
                  Rules
                </Link>
                .
              </p>
              <p className="text-sm leading-relaxed text-muted">
                If something looks off compared to the rest of the pack, pause
                and ask in Discord before continuing.
              </p>
              <GameModeSettingsGuide />
            </div>
          </Frame>
        </li>

        <li>
          <Frame title="4. Export your save & import it here">
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
              <li>
                In Afterplay (or your emulator), download / export your save
                (Gen&nbsp;3{" "}
                <code className="rounded-lg bg-surface-2 px-1">.sav</code> /{" "}
                <code className="rounded-lg bg-surface-2 px-1">.srm</code>).
              </li>
              <li>
                {session?.user ? (
                  <>
                    Open{" "}
                    <Link
                      href={trainerHref}
                      className="font-bold text-accent-deep underline-offset-2 hover:underline"
                    >
                      your trainer board
                    </Link>{" "}
                    and use{" "}
                    <span className="font-bold text-ink">Import save</span>.
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="font-bold text-accent-deep underline-offset-2 hover:underline"
                    >
                      Sign in with Discord
                    </Link>
                    , open your trainer board, and use{" "}
                    <span className="font-bold text-ink">Import save</span>.
                  </>
                )}
              </li>
              <li>
                Review the mapped party → Main Squad, boxes → Reserves, fainted
                → R.I.P., then apply. You can re-import as the run progresses.
              </li>
            </ol>
            {session?.user ? (
              <Link href={trainerHref} className={`${CTA_PRIMARY} mt-4`}>
                Open trainer board →
              </Link>
            ) : null}
          </Frame>
        </li>

        <li>
          <Frame
            title="5. Have fun!"
            className="border-accent/40 [--gba-fill:color-mix(in_srgb,var(--accent)_10%,var(--surface))]"
          >
            <p className="text-sm leading-relaxed text-muted">
              You&apos;re set — play the run and keep the board in sync.
            </p>
            <ul className="mt-4 overflow-hidden rounded-lg border border-frame/45 bg-surface/70 text-sm">
              <li className="flex gap-3 border-b border-frame/30 px-3 py-2.5">
                <span
                  className="mt-0.5 font-bold text-accent-deep"
                  aria-hidden
                >
                  ·
                </span>
                <span>
                  <span className="font-semibold text-ink">Re-import</span>
                  <span className="text-muted">
                    {" "}
                    your save as badges fall and the party changes
                  </span>
                </span>
              </li>
              <li className="flex gap-3 border-b border-frame/30 px-3 py-2.5">
                <span
                  className="mt-0.5 font-bold text-accent-deep"
                  aria-hidden
                >
                  ·
                </span>
                <span>
                  <span className="font-semibold text-ink">React</span>
                  <span className="text-muted">
                    {" "}
                    in the Pack feed when someone hits a big moment
                  </span>
                </span>
              </li>
              <li className="flex gap-3 px-3 py-2.5">
                <span
                  className="mt-0.5 font-bold text-accent-deep"
                  aria-hidden
                >
                  ·
                </span>
                <span>
                  <span className="font-semibold text-ink">Rules / FAQ</span>
                  <span className="text-muted">
                    {" "}
                    when you&apos;re unsure —{" "}
                    <Link
                      href={`/challenges/${challenge.slug}/rules`}
                      className="font-bold text-accent-deep underline-offset-2 hover:underline"
                    >
                      open them here
                    </Link>
                  </span>
                </span>
              </li>
            </ul>
            <Link
              href={`/challenges/${challenge.slug}`}
              className={`${CTA_PRIMARY} mt-4`}
            >
              Open league board →
            </Link>
          </Frame>
        </li>
      </ol>
    </>
  );
}
