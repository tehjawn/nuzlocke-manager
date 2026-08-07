"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { CompleteFirstRunLink } from "@/components/CompleteFirstRunLink";
import { Frame } from "@/components/Frame";
import { SaveExportGuide } from "@/components/SaveExportGuide";
import { WelcomeVideoPanel } from "@/components/WelcomeVideoPanel";
import { CTA_PRIMARY } from "@/lib/cta";
import { withOrderedPrefixCheck } from "@/lib/ordered-prefix-check";
import {
  isSetupSectionChecked,
  nextSetupSection,
  readSetupCheckoffs,
  setSetupSectionChecked,
  setupCheckoffsStorageKey,
  SETUP_SECTION_IDS,
  subscribeSetupCheckoffs,
  type SetupCheckoffs,
  type SetupSectionId,
} from "@/lib/setup-checkoffs";
import type { WelcomeVideoEmbed } from "@/lib/welcome-video";
import { toolsHref } from "@/lib/tools-routes";

const AFTERPLAY_URL = "https://afterplay.io";

type GetStartedViewProps = {
  slug: string;
  trainerHref: string;
  trainerId: string | null;
  /** True when the player already has party Pokémon (import done). */
  hasImportedSave: boolean;
  signedIn: boolean;
  romUrl: string;
  welcomeEmbed: WelcomeVideoEmbed | null;
  welcomeLockedMessage: string | null;
  welcomeFallbackUrl: string | null;
};

function sectionTitle(
  label: string,
  checked: boolean,
  index: number,
): ReactNode {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
          checked
            ? "border-accent bg-accent/20 text-accent-deep"
            : "border-frame text-muted"
        }`}
        aria-hidden
      >
        {checked ? "✓" : index}
      </span>
      <span className="min-w-0">{label}</span>
    </span>
  );
}

/** Treat server-known imports as checked without a mount-effect write. */
function checkoffsWithImport(
  checkoffs: SetupCheckoffs,
  hasImportedSave: boolean,
): SetupCheckoffs {
  if (!hasImportedSave || isSetupSectionChecked(checkoffs, "import")) {
    return checkoffs;
  }
  return {
    checkedSectionIds: withOrderedPrefixCheck(
      SETUP_SECTION_IDS,
      checkoffs.checkedSectionIds,
      "import",
      true,
    ),
  };
}

export function GetStartedView({
  slug,
  trainerHref,
  trainerId,
  hasImportedSave,
  signedIn,
  romUrl,
  welcomeEmbed,
  welcomeLockedMessage,
  welcomeFallbackUrl,
}: GetStartedViewProps) {
  const storageKey = setupCheckoffsStorageKey(slug, trainerId);
  const storedCheckoffs = useSyncExternalStore(
    (onStoreChange) => subscribeSetupCheckoffs(storageKey, onStoreChange),
    () => readSetupCheckoffs(storageKey),
    () => readSetupCheckoffs(storageKey),
  );
  const checkoffs = checkoffsWithImport(storedCheckoffs, hasImportedSave);

  const sectionRefs = useRef<
    Partial<Record<SetupSectionId, HTMLElement | null>>
  >({});
  // `null` = follow autoExpand; `"closed"` = user collapsed everything
  // (so closing the auto-expanded section doesn't no-op back to open).
  const [expanded, setExpanded] = useState<SetupSectionId | "closed" | null>(
    null,
  );

  function markDone(id: SetupSectionId) {
    const nextCheckoffs = setSetupSectionChecked(storageKey, id, true);
    const sealed =
      hasImportedSave && !isSetupSectionChecked(nextCheckoffs, "import")
        ? setSetupSectionChecked(storageKey, "import", true)
        : nextCheckoffs;
    const next = nextSetupSection(sealed);
    setExpanded(next);
    if (next) {
      requestAnimationFrame(() => {
        sectionRefs.current[next]?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }

  const autoExpand = nextSetupSection(checkoffs);
  const openId = expanded === "closed" ? null : (expanded ?? autoExpand);

  const welcomeDone = isSetupSectionChecked(checkoffs, "welcome");
  const romDone = isSetupSectionChecked(checkoffs, "rom");
  const afterplayDone = isSetupSectionChecked(checkoffs, "afterplay");
  const gamemodeDone = isSetupSectionChecked(checkoffs, "gamemode");
  const importDone =
    isSetupSectionChecked(checkoffs, "import") || hasImportedSave;

  // Once import is detected, collapse step 5 if the user had it open.
  const [importDoneSeen, setImportDoneSeen] = useState(importDone);
  if (importDone !== importDoneSeen) {
    setImportDoneSeen(importDone);
    if (importDone && expanded === "import") {
      setExpanded("closed");
    }
  }

  function bindOpen(id: SetupSectionId) {
    return {
      open: openId === id,
      onOpenChange: (open: boolean) => {
        if (open) setExpanded(id);
        else if (openId === id) setExpanded("closed");
      },
    };
  }

  return (
    <>
      <header className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Get Started</h2>
        <p className="mt-2 text-muted">
          Work through each step — check one off and the next opens. Download
          the ROM, load it in Afterplay, save the pre-loaded Game Mode settings,
          export your save, then import it on your trainer board. Checking a
          later step marks earlier ones too.
        </p>
      </header>

      <div className="space-y-3">
        <div
          ref={(node) => {
            sectionRefs.current.welcome = node;
          }}
        >
          <Frame
            data-tour="setup-welcome"
            collapsible
            {...bindOpen("welcome")}
            title={sectionTitle("Welcome", welcomeDone, 1)}
          >
            <p className="mb-4 text-sm leading-relaxed text-muted">
              A message from Jason (@Oubori) to kick off Season 2026 — then
              follow the steps below to get your run online.
            </p>
            <WelcomeVideoPanel
              embed={welcomeEmbed}
              lockedMessage={welcomeLockedMessage}
              fallbackUrl={welcomeFallbackUrl}
            />
            {!welcomeDone ? (
              <button
                type="button"
                className={`${CTA_PRIMARY} mt-4`}
                onClick={() => markDone("welcome")}
              >
                Got it!
              </button>
            ) : (
              <p className="mt-4 text-xs font-semibold text-accent-deep">
                Welcome checked off
              </p>
            )}
          </Frame>
        </div>

        <div
          ref={(node) => {
            sectionRefs.current.rom = node;
          }}
        >
          <Frame
            collapsible
            {...bindOpen("rom")}
            title={sectionTitle("Download the ROM", romDone, 2)}
          >
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
              onClick={() => markDone("rom")}
            >
              Download ROM →
            </a>
          </Frame>
        </div>

        <div
          ref={(node) => {
            sectionRefs.current.afterplay = node;
          }}
        >
          <Frame
            collapsible
            {...bindOpen("afterplay")}
            title={sectionTitle("Load the ROM in Afterplay", afterplayDone, 3)}
          >
            <ol className="overflow-hidden rounded-lg border border-frame/45 bg-surface/70 text-sm">
              <li className="flex gap-3 border-b border-frame/30 px-3 py-2.5">
                <span
                  className="mt-0.5 w-4 shrink-0 font-bold text-accent-deep"
                  aria-hidden
                >
                  1
                </span>
                <span className="text-muted">
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
                </span>
              </li>
              <li className="flex gap-3 border-b border-frame/30 px-3 py-2.5">
                <span
                  className="mt-0.5 w-4 shrink-0 font-bold text-accent-deep"
                  aria-hidden
                >
                  2
                </span>
                <span className="text-muted">
                  Add a Game Boy Advance game and upload the ROM you downloaded.
                </span>
              </li>
              <li className="flex gap-3 px-3 py-2.5">
                <span
                  className="mt-0.5 w-4 shrink-0 font-bold text-accent-deep"
                  aria-hidden
                >
                  3
                </span>
                <span className="text-muted">
                  Open the game from your Afterplay library when you&apos;re
                  ready to play.
                </span>
              </li>
            </ol>
            <a
              href={AFTERPLAY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${CTA_PRIMARY} mt-4`}
              onClick={() => markDone("afterplay")}
            >
              Open Afterplay →
            </a>
          </Frame>
        </div>

        <div
          ref={(node) => {
            sectionRefs.current.gamemode = node;
          }}
        >
          <Frame
            collapsible
            {...bindOpen("gamemode")}
            title={sectionTitle(
              "Match season Game Mode settings",
              gamemodeDone,
              4,
            )}
          >
            <ul className="overflow-hidden rounded-lg border border-frame/45 bg-surface/70 text-sm">
              <li className="flex gap-3 border-b border-frame/30 px-3 py-2.5">
                <span className="mt-0.5 font-bold text-accent-deep" aria-hidden>
                  ·
                </span>
                <span className="text-muted">
                  When starting a new game after character creation, the game
                  mode settings options will appear.
                </span>
              </li>
              <li className="flex gap-3 border-b border-frame/30 px-3 py-2.5">
                <span className="mt-0.5 font-bold text-accent-deep" aria-hidden>
                  ·
                </span>
                <span className="text-muted">
                  Because the &quot;game mode settings&quot; are already
                  pre-loaded, do not change anything.
                </span>
              </li>
              <li className="flex gap-3 px-3 py-2.5">
                <span className="mt-0.5 font-bold text-accent-deep" aria-hidden>
                  ·
                </span>
                <span className="text-muted">
                  Keep clicking next page and &quot;Save&quot; the game mode
                  setting to begin your game.
                </span>
              </li>
            </ul>
            {!gamemodeDone ? (
              <button
                type="button"
                className={`${CTA_PRIMARY} mt-4`}
                onClick={() => markDone("gamemode")}
              >
                Understood!
              </button>
            ) : (
              <p className="mt-4 text-xs font-semibold text-accent-deep">
                Game Mode checked off
              </p>
            )}
          </Frame>
        </div>

        <div
          ref={(node) => {
            sectionRefs.current.import = node;
          }}
        >
          <Frame
            collapsible
            {...bindOpen("import")}
            title={sectionTitle(
              "Export your save & import it here",
              importDone,
              5,
            )}
          >
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-muted">
                Export a save from Afterplay, then import it on your trainer
                board to sync party, boxes, and R.I.P. This step checks off when
                your first save lands on the board.
              </p>
              <SaveExportGuide />
              <ol className="overflow-hidden rounded-lg border border-frame/45 bg-surface/70 text-sm">
                <li className="flex gap-3 border-b border-frame/30 px-3 py-2.5">
                  <span
                    className="mt-0.5 w-4 shrink-0 font-bold text-accent-deep"
                    aria-hidden
                  >
                    1
                  </span>
                  <span className="text-muted">
                    {signedIn ? (
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
                  </span>
                </li>
                <li className="flex gap-3 px-3 py-2.5">
                  <span
                    className="mt-0.5 w-4 shrink-0 font-bold text-accent-deep"
                    aria-hidden
                  >
                    2
                  </span>
                  <span className="text-muted">
                    Review the mapped party → Main Squad, boxes → Reserves,
                    fainted → R.I.P., then apply. You can re-import as the run
                    progresses.
                  </span>
                </li>
              </ol>
              {signedIn && (
                <Link href={trainerHref} className={CTA_PRIMARY}>
                  Open trainer board & import save →
                </Link>
              )}
              {importDone && (
                <p className="text-xs font-semibold text-accent-deep">
                  First save imported — nice work
                </p>
              )}
            </div>
          </Frame>
        </div>

        <Frame
          title="Have fun!"
          className="border-accent/40 [--gba-fill:color-mix(in_srgb,var(--accent)_10%,var(--surface))]"
        >
          <p className="text-sm leading-relaxed text-muted">
            You&apos;re set — play the run and keep the board in sync.
          </p>
          <ul className="mt-4 overflow-hidden rounded-lg border border-frame/45 bg-surface/70 text-sm">
            <li className="flex gap-3 border-b border-frame/30 px-3 py-2.5">
              <span className="mt-0.5 font-bold text-accent-deep" aria-hidden>
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
              <span className="mt-0.5 font-bold text-accent-deep" aria-hidden>
                ·
              </span>
              <span>
                <span className="font-semibold text-ink">Season Stats</span>
                <span className="text-muted">
                  {" "}
                  when a run ends — honor the team on the season memorial
                </span>
              </span>
            </li>
            <li className="flex gap-3 px-3 py-2.5">
              <span className="mt-0.5 font-bold text-accent-deep" aria-hidden>
                ·
              </span>
              <span>
                <span className="font-semibold text-ink">Rules / FAQ</span>
                <span className="text-muted">
                  {" "}
                  when you&apos;re unsure —{" "}
                  <Link
                    href={`/challenges/${slug}/rules`}
                    className="font-bold text-accent-deep underline-offset-2 hover:underline"
                  >
                    open them here
                  </Link>
                </span>
              </span>
            </li>
          </ul>
          <CompleteFirstRunLink
            href={`/challenges/${slug}`}
            className={`${CTA_PRIMARY} mt-4`}
          >
            Open league board →
          </CompleteFirstRunLink>
        </Frame>

        <Frame title="Stuck? Use the Game Guide tool!">
          <p className="text-sm leading-relaxed text-muted">
            Not sure what to do next in Modern Emerald? The Game Guide walks you
            through story gates and easy-to-miss beats (Steven, Rock Smash /
            Rusturf, Dive, and more) with a checklist you can check off as you
            go.
          </p>
          <Link
            href={toolsHref(slug, "guide")}
            className={`${CTA_PRIMARY} mt-4`}
          >
            Open Game Guide →
          </Link>
        </Frame>
      </div>
    </>
  );
}
