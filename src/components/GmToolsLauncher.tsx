"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useId,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { gmResetAllTrainerBoardsAction } from "@/app/actions/challenge";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { writeGmLensOnClient } from "@/lib/gm-lens";
import { useMediaQuery } from "@/lib/use-media-query";

type GmToolsLauncherProps = {
  slug: string;
  /** Season label shown under the panel title (e.g. challenge name). */
  seasonLabel?: string | null;
  initialOn: boolean;
};

/**
 * GM-only floating launcher: toggle GM view and open the GM console.
 * Desktop uses a compact popover; mobile opens a bottom sheet.
 */
export function GmToolsLauncher({
  slug,
  seasonLabel = null,
  initialOn,
}: GmToolsLauncherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState(initialOn);
  const [seenInitialOn, setSeenInitialOn] = useState(initialOn);
  const [pending, startTransition] = useTransition();
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const isDesktop = useMediaQuery("(min-width: 640px)", false);
  const [seenDesktop, setSeenDesktop] = useState(isDesktop);
  const [seenPath, setSeenPath] = useState(pathname);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const panelId = useId();
  const switchDescId = useId();

  // Close after in-app navigation (e.g. Open GM console).
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (open) setOpen(false);
  }

  // Keep switch in sync after cookie + router.refresh() without an effect.
  if (seenInitialOn !== initialOn) {
    setSeenInitialOn(initialOn);
    setOn(initialOn);
  }

  // Close when crossing the desktop/mobile layout breakpoint.
  if (seenDesktop !== isDesktop) {
    setSeenDesktop(isDesktop);
    if (open) setOpen(false);
  }

  function closePanel() {
    setOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }

  function setGmView(next: boolean) {
    if (next === on) return;
    setOn(next);
    writeGmLensOnClient(slug, next);
    startTransition(() => {
      router.refresh();
    });
  }

  function onPanelKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      closePanel();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [role="switch"]:not([disabled])',
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function resetAllBoards() {
    void (async () => {
      const ok = await confirm({
        title: "Reset all trainer boards?",
        description:
          "Clears every trainer’s party, memorial, badges, wipe counts, and revive tokens for an official season start. A history snapshot is saved for each board first. Profiles and claims stay. Export a backup from the GM console if needed.",
        confirmLabel: "Reset all boards",
        tone: "danger",
      });
      if (!ok) return;
      setResetMessage(null);
      setResetError(null);
      startTransition(async () => {
        const result = await gmResetAllTrainerBoardsAction({ slug });
        if (result.ok) {
          setResetMessage(result.message ?? "All boards reset");
          router.refresh();
        } else {
          setResetError(result.error);
        }
      });
    })();
  }

  const gmConsoleHref = `/challenges/${slug}/gm`;
  const subtitle = seasonLabel?.trim() || "Game Master controls";

  const panelBody = (
    <>
      <header className="gm-tools-panel__title relative z-[1] flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="gm-tools-panel__eyebrow">Game Master</p>
          <h2 id={titleId} className="gm-tools-panel__heading">
            GM Tools
          </h2>
          <p className="gm-tools-panel__subtitle truncate">{subtitle}</p>
        </div>
        <button
          type="button"
          aria-label="Close GM tools"
          onClick={closePanel}
          className="gm-tools-panel__close"
        >
          Close
        </button>
      </header>

      <div className="gm-tools-panel__body relative z-[1] space-y-3 p-4">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="GM view"
          aria-describedby={switchDescId}
          disabled={pending}
          onClick={() => setGmView(!on)}
          className={`gm-tools-panel__switch ${on ? "gm-tools-panel__switch--on" : ""}`}
        >
          <span className="min-w-0">
            <span className="gm-tools-panel__switch-label" aria-hidden>
              GM view
            </span>
            <span id={switchDescId} className="gm-tools-panel__switch-desc">
              {on
                ? "View and edit all trainer boards"
                : "Player view — your board only"}
            </span>
          </span>
          <span className="gm-tools-panel__toggle" aria-hidden>
            <span className="gm-tools-panel__toggle-knob" />
          </span>
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={resetAllBoards}
          className="gm-tools-panel__danger"
        >
          <span className="gm-tools-panel__danger-label">Reset all boards</span>
          <span className="gm-tools-panel__danger-desc">
            Clear every trainer for an official season start
          </span>
        </button>

        {resetMessage ? (
          <p className="text-xs font-semibold text-accent-deep">{resetMessage}</p>
        ) : null}
        {resetError ? (
          <p className="text-xs font-semibold text-danger">{resetError}</p>
        ) : null}

        <Link href={gmConsoleHref} className="gm-tools-panel__console">
          <GmConsoleLinkLabel />
        </Link>
      </div>
    </>
  );

  const panelClassName = `gm-tools-panel overflow-hidden outline-none ${
    on ? "gm-tools-panel--active" : ""
  }`;

  return (
    <>
      <div
        className="pointer-events-none fixed right-[max(1rem,env(safe-area-inset-right,0px))] bottom-[max(5rem,calc(1.25rem+env(safe-area-inset-bottom,0px)))] z-40 sm:bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
      >
        <div className="pointer-events-auto relative">
          {open && isDesktop ? (
            <div className="absolute right-0 bottom-[calc(100%+0.5rem)] w-[min(20rem,calc(100vw-2rem))]">
              <div
                ref={panelRef}
                id={panelId}
                role="dialog"
                aria-labelledby={titleId}
                tabIndex={-1}
                autoFocus
                onKeyDown={onPanelKeyDown}
                className={panelClassName}
              >
                <div className="gm-tools-panel__chrome">{panelBody}</div>
              </div>
            </div>
          ) : null}

          <div className={`gm-tools-fab ${on ? "gm-tools-fab--active" : ""}`}>
            <button
              ref={triggerRef}
              type="button"
              aria-label="Open GM tools"
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={open ? panelId : undefined}
              onClick={() => setOpen((v) => !v)}
              className="gm-tools-fab__btn"
            >
              <span aria-hidden>GM</span>
            </button>
          </div>
        </div>
      </div>

      {open && isDesktop && typeof document !== "undefined"
        ? createPortal(
            <button
              type="button"
              tabIndex={-1}
              aria-label="Close GM tools"
              className="fixed inset-0 z-[39] cursor-default bg-transparent"
              onClick={closePanel}
            />,
            document.body,
          )
        : null}

      {open && !isDesktop && typeof document !== "undefined"
        ? createPortal(
            <div data-modal-open="" className="fixed inset-0 z-[100] sm:hidden">
              <button
                type="button"
                aria-label="Close GM tools"
                onClick={closePanel}
                className="absolute inset-0 cursor-pointer bg-[var(--scrim)] backdrop-blur-[2px] motion-safe:animate-[drawer-scrim-in_200ms_ease-out]"
              />
              <div
                ref={panelRef}
                id={panelId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                autoFocus
                onKeyDown={onPanelKeyDown}
                className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-hidden pb-[env(safe-area-inset-bottom,0px)] outline-none motion-safe:animate-[sheet-up-in_240ms_cubic-bezier(0.22,1,0.36,1)]"
              >
                <div className={`${panelClassName} rounded-none rounded-t-xl`}>
                  <div className="gm-tools-panel__chrome rounded-t-[calc(var(--radius)+2px)] border-b-0">
                    {panelBody}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {confirmDialog}
    </>
  );
}

type GmViewBannerProps = {
  slug: string;
  initialOn: boolean;
};

/** Inline pending hint for the GM console Link (must be a Link descendant). */
function GmConsoleLinkLabel() {
  const { pending } = useLinkStatus();
  return (
    <span
      className={`gm-tools-panel__console-label${pending ? " is-pending" : ""}`}
      aria-busy={pending}
    >
      {pending ? "Opening…" : "Open GM console"}
      <span
        aria-hidden
        className={`gm-tools-panel__console-hint${pending ? " is-pending" : ""}`}
      />
    </span>
  );
}

/**
 * Persistent reminder that GM view is on — shown near the top so browsing
 * another trainer’s board never looks like player view.
 */
export function GmViewBanner({ slug, initialOn }: GmViewBannerProps) {
  const router = useRouter();
  const [on, setOn] = useState(initialOn);
  const [seenInitialOn, setSeenInitialOn] = useState(initialOn);
  const [pending, startTransition] = useTransition();

  if (seenInitialOn !== initialOn) {
    setSeenInitialOn(initialOn);
    setOn(initialOn);
  }

  if (!on) return null;

  function exit() {
    setOn(false);
    writeGmLensOnClient(slug, false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="gm-view-banner sticky top-0 z-30" role="status" aria-live="polite">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-1.5 text-sm sm:px-6">
        <span className="gm-view-banner__badge" aria-hidden>
          GM
        </span>
        <span className="gm-view-banner__label min-w-0 flex-1">
          GM view active
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={exit}
          className="gm-view-banner__exit"
          aria-label="Exit GM view"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
