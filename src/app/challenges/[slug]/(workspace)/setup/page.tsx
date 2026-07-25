import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Frame } from "@/components/Frame";
import { getChallenge } from "@/lib/challenges";
import { CTA_PRIMARY } from "@/lib/cta";

export const dynamic = "force-dynamic";

const ROM_DOWNLOAD_URL =
  "https://drive.google.com/file/d/1gW4d5CSna2rpGNK8B0JNdILr115hbp33/view";
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

  const trainerHref = `/challenges/${challenge.slug}/me`;

  return (
    <>
      <header className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">
          Get Started
        </h2>
        <p className="mt-2 text-muted">
          Four moves: download the ROM, load it in Afterplay, export your save,
          then import it on your trainer board.
        </p>
      </header>

      <ol className="space-y-4">
        <li>
          <Frame title="1. Download the ROM">
            <p className="text-sm leading-relaxed text-muted">
              Grab the Trash Pack Emerald ROM from Google Drive. This build is
              already set up for the season (including the Gen&nbsp;1–4 Nuzlocke
              toolkit and 2× experience).
            </p>
            <a
              href={ROM_DOWNLOAD_URL}
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
          <Frame title="3. Start with season settings">
            <p className="text-sm leading-relaxed text-muted">
              When you boot into the run, confirm the pack settings match the
              season rules:
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              <li>
                <span className="font-bold text-ink">Experience:</span> 2× EXP
                multiplier enabled.
              </li>
              <li>
                <span className="font-bold text-ink">Nuzlocke toolkit:</span>{" "}
                Gen&nbsp;1–4 Nuzlocke helpers / randomizers as configured in the
                shared ROM (don&apos;t swap to a different patch mid-season).
              </li>
              <li>
                <span className="font-bold text-ink">Core rules:</span> faint =
                dead, first encounter only, nicknames required — see{" "}
                <Link
                  href={`/challenges/${challenge.slug}/rules`}
                  className="font-bold text-accent-deep underline-offset-2 hover:underline"
                >
                  Rules
                </Link>
                .
              </li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              If something looks off compared to the rest of the pack, pause and
              ask in Discord before continuing.
            </p>
          </Frame>
        </li>

        <li>
          <Frame title="4. Export your save & import it here">
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
              <li>
                In Afterplay, download / export your save (Gen&nbsp;3{" "}
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
          <Frame title="5. React to milestones in the Pack feed">
            <p className="text-sm leading-relaxed text-muted">
              Board updates and imports show up in the Pack feed on the left.
              Sign in, then react with any emoji when someone badges up, loses a
              mon, or hits a big moment.
            </p>
          </Frame>
        </li>
      </ol>
    </>
  );
}
