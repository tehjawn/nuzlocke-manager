"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { CTA_PRIMARY_SM, CTA_SECONDARY_SM } from "@/lib/cta";
import {
  ONBOARDING_STEPS,
  clearOnboardingStep,
  onboardingMismatchAction,
  readOnboardingStep,
  readOnboardingTransition,
  requestOnboardingMobilePanel,
  writeOnboardingActive,
  writeOnboardingStep,
  writeOnboardingTransition,
  type OnboardingStep,
} from "@/lib/onboarding";

type OnboardingTourProps = {
  open: boolean;
  onDismiss: () => void;
};

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const PAD = 10;
const POPOVER_GAP = 14;
const POPOVER_WIDTH = 360;
const VIEW_MARGIN = 12;
const MOVE_MS = 320;
/** Match Tailwind `sm` — below this, dock the coachmark as a bottom sheet. */
const NARROW_MAX = 639;
/**
 * Match Tailwind `lg` — below this the season left rail is hidden and
 * MobileWorkspace owns Info/Feed + section tabs.
 */
const MOBILE_CHROME_MAX = 1023;
/** Keep spotlight cutouts from eating the whole phone viewport. */
const MAX_HOLE_VH = 0.44;
/** Reserve room above the bottom sheet when scrolling a target into view. */
const MOBILE_SHEET_RESERVE = 280;

// Client-only flag (portals need `document.body`) without a mount effect —
// false during SSR/first paint, true once React reads live browser state.
const noopSubscribe = () => () => {};
const getIsClient = () => true;
const getIsServer = () => false;

function isNarrowViewport() {
  return window.innerWidth <= NARROW_MAX;
}

function isMobileChrome() {
  return window.innerWidth <= MOBILE_CHROME_MAX;
}

/**
 * Prefer a *visible* match. Some anchors (e.g. the season tabs) render once per
 * breakpoint with the off-breakpoint copy hidden via `display:none`, which has
 * no client rects — picking it would spotlight an empty 0×0 box.
 */
function queryTarget(selector: string): Element | null {
  const matches = document.querySelectorAll(selector);
  for (const el of matches) {
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

function waitForElement(
  selector: string,
  timeoutMs = 5000,
): Promise<Element | null> {
  const existing = queryTarget(selector);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const el = queryTarget(selector);
      if (el) {
        resolve(el);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(null);
        return;
      }
      window.requestAnimationFrame(tick);
    };
    tick();
  });
}

function measureElement(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
  };
}

/** Scroll so the target sits in the band above the mobile bottom sheet. */
function scrollTargetIntoTourView(
  el: Element,
  opts?: { instantScroll?: boolean; reservedBottom?: number },
) {
  const narrow = isNarrowViewport();
  const reservedBottom = opts?.reservedBottom ?? 0;
  const behavior = opts?.instantScroll ? "instant" : "smooth";

  if (!narrow || reservedBottom <= 0) {
    el.scrollIntoView({
      behavior,
      block: "center",
      inline: "nearest",
    });
    return;
  }

  // Horizontal: keep tab pills in the mobile scroller visible.
  el.scrollIntoView({
    behavior,
    block: "nearest",
    inline: "center",
  });

  const rect = el.getBoundingClientRect();
  const available = window.innerHeight - reservedBottom - VIEW_MARGIN;
  const idealTop = Math.max(VIEW_MARGIN + 8, available * 0.12);
  const delta = rect.top - idealTop;
  if (Math.abs(delta) > 10) {
    window.scrollBy({ top: delta, left: 0, behavior });
  }
}

async function prepareStepTarget(
  step: OnboardingStep,
  opts?: { instantScroll?: boolean },
): Promise<Rect | null> {
  if (step.mobilePanel !== undefined && isMobileChrome()) {
    requestOnboardingMobilePanel(step.mobilePanel);
    // Let React commit the Info/Feed panel before querying anchors inside it.
    await new Promise((r) => window.setTimeout(r, 40));
  }

  if (!step.element) {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    return null;
  }

  const el = await waitForElement(step.element);
  if (!el) return null;

  scrollTargetIntoTourView(el, {
    instantScroll: opts?.instantScroll,
    reservedBottom: isNarrowViewport() ? MOBILE_SHEET_RESERVE : 0,
  });

  await new Promise((r) =>
    window.setTimeout(r, opts?.instantScroll ? 40 : MOVE_MS),
  );
  return measureElement(el);
}

function placePopover(
  target: Rect | null,
  popoverHeight: number,
): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const narrow = isNarrowViewport();
  const width = Math.min(POPOVER_WIDTH, vw - VIEW_MARGIN * 2);

  // Phones: dock as a bottom sheet so the spotlight stays in the upper band.
  // Safe-area is applied via CSS padding on the popover (included in height).
  if (narrow) {
    const top = Math.max(VIEW_MARGIN, vh - VIEW_MARGIN - popoverHeight);
    return {
      position: "fixed",
      top,
      left: VIEW_MARGIN,
      width: vw - VIEW_MARGIN * 2,
      transform: "none",
    };
  }

  // Always use numeric top/left so CSS can tween between steps.
  if (!target) {
    return {
      position: "fixed",
      top: Math.max(VIEW_MARGIN, (vh - popoverHeight) / 2),
      left: Math.max(VIEW_MARGIN, (vw - width) / 2),
      width,
      transform: "none",
    };
  }

  const belowTop = target.top + target.height + PAD + POPOVER_GAP;
  const aboveTop = target.top - PAD - POPOVER_GAP - popoverHeight;
  const spaceBelow = vh - belowTop - VIEW_MARGIN;
  const spaceAbove = target.top - PAD - VIEW_MARGIN;

  let top: number;
  if (spaceBelow >= popoverHeight || spaceBelow >= spaceAbove) {
    top = Math.min(belowTop, vh - VIEW_MARGIN - popoverHeight);
  } else {
    top = Math.max(VIEW_MARGIN, aboveTop);
  }

  const targetCenterX = target.left + target.width / 2;
  let left = targetCenterX - width / 2;
  left = Math.max(VIEW_MARGIN, Math.min(left, vw - VIEW_MARGIN - width));

  return {
    position: "fixed",
    top,
    left,
    width,
    transform: "none",
  };
}

function holeFromTarget(target: Rect | null): {
  top: number;
  left: number;
  width: number;
  height: number;
} {
  if (!target) {
    return {
      top: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
      left: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
      width: 0,
      height: 0,
    };
  }

  const top = Math.max(0, target.top - PAD);
  const left = Math.max(0, target.left - PAD);
  const width = target.width + PAD * 2;
  let height = target.height + PAD * 2;

  // Tall party grids: keep the cutout to the top of the target so empty slots
  // stay readable above the bottom sheet instead of filling the screen.
  if (isNarrowViewport()) {
    const maxH = window.innerHeight * MAX_HOLE_VH;
    if (height > maxH) height = maxH;
    const sheetTop = window.innerHeight - MOBILE_SHEET_RESERVE;
    if (top + height > sheetTop - 8) {
      height = Math.max(48, sheetTop - 8 - top);
    }
  }

  return { top, left, width, height };
}

export function OnboardingTour({ open, onDismiss }: OnboardingTourProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const readyRef = useRef(false);

  const mounted = useSyncExternalStore(noopSubscribe, getIsClient, getIsServer);
  const [stepIndex, setStepIndex] = useState(() => readOnboardingStep());
  const [bridging, setBridging] = useState(() => readOnboardingTransition());
  const [target, setTarget] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const [moving, setMoving] = useState(false);
  const [popoverHeight, setPopoverHeight] = useState(220);
  const [contentKey, setContentKey] = useState(0);
  const [openSeen, setOpenSeen] = useState(open);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  // Adjust local tour state when `open` flips (preferred over a sync effect).
  // Persistent storage writes stay in effects / handlers — not here — so a
  // discarded render cannot clear a live bridge flag.
  if (open !== openSeen) {
    setOpenSeen(open);
    if (open) {
      setStepIndex(readOnboardingStep());
      if (readOnboardingTransition()) setBridging(true);
    } else {
      setReady(false);
      setTarget(null);
      setMoving(false);
      setBridging(false);
    }
  }

  // Clear the bridge flag only after `open` commits closed.
  useEffect(() => {
    if (!open) writeOnboardingTransition(false);
  }, [open]);

  const step = ONBOARDING_STEPS[stepIndex] ?? ONBOARDING_STEPS[0];
  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= ONBOARDING_STEPS.length - 1;
  const isOverlay = !step?.element;

  const beginBridge = useCallback(() => {
    writeOnboardingTransition(true);
    setBridging(true);
    setReady(false);
    readyRef.current = false;
  }, []);

  const endBridge = useCallback(() => {
    writeOnboardingTransition(false);
    setBridging(false);
  }, []);

  const finish = useCallback(() => {
    clearOnboardingStep();
    writeOnboardingTransition(false);
    writeOnboardingActive(false);
    setBridging(false);
    setReady(false);
    readyRef.current = false;
    if (isMobileChrome()) {
      requestOnboardingMobilePanel(null);
    }
    onDismissRef.current();
  }, []);

  const goToStep = useCallback(
    (nextIndex: number) => {
      const next = ONBOARDING_STEPS[nextIndex];
      if (!next) return;
      writeOnboardingStep(nextIndex);
      setStepIndex(nextIndex);
      setContentKey((k) => k + 1);

      if (!next.match(pathname)) {
        beginBridge();
        router.push(next.href);
      } else if (readyRef.current) {
        // Same page — keep UI mounted; just glide to the next target.
        setMoving(true);
      }
    },
    [beginBridge, pathname, router],
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const active = ONBOARDING_STEPS[stepIndex];
    if (!active) {
      // Defer: finish() sets state; calling it sync in an effect trips lint.
      queueMicrotask(() => {
        if (!cancelled) finish();
      });
      return () => {
        cancelled = true;
      };
    }

    if (!active.match(pathname)) {
      // Next/Back bridges keep navigating. Manual league-board landings finish
      // the tour (unlock chrome). Other destinations pause without yanking.
      const action = onboardingMismatchAction(
        pathname,
        readOnboardingTransition(),
      );
      if (action === "bridge") {
        queueMicrotask(() => {
          if (cancelled) return;
          beginBridge();
          router.push(active.href);
        });
        return () => {
          cancelled = true;
        };
      }
      if (action === "complete") {
        queueMicrotask(() => {
          if (!cancelled) finish();
        });
        return () => {
          cancelled = true;
        };
      }
      queueMicrotask(() => {
        if (cancelled) return;
        setReady(false);
        readyRef.current = false;
        setTarget(null);
        setMoving(false);
        setBridging(false);
      });
      return () => {
        cancelled = true;
      };
    }

    const stayVisible = readyRef.current && !readOnboardingTransition();

    void (async () => {
      if (!stayVisible) setMoving(false);

      const rect = await prepareStepTarget(active, {
        instantScroll: !stayVisible,
      });
      if (cancelled) return;

      setTarget(rect);
      endBridge();
      setReady(true);
      readyRef.current = true;
      // Let geometry tween finish before re-enabling Next/Back.
      window.setTimeout(() => {
        if (!cancelled) setMoving(false);
      }, MOVE_MS);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, pathname, stepIndex, router, beginBridge, endBridge, finish]);

  useEffect(() => {
    if (!open || !ready || !step?.element) return;

    const update = () => {
      const el = queryTarget(step.element!);
      if (el) setTarget(measureElement(el));
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, ready, step?.element]);

  useLayoutEffect(() => {
    if (!ready) return;
    const node = document.querySelector<HTMLElement>("[data-tour-popover]");
    if (!node) return;
    // Measures post-layout DOM geometry — can only happen after paint, so
    // this has to be a layout effect rather than computed during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPopoverHeight(node.getBoundingClientRect().height);
  }, [ready, stepIndex, target]);

  if (!mounted || !open) return null;

  const spotlightTarget = !isOverlay ? target : null;
  const popoverStyle = placePopover(spotlightTarget, popoverHeight);
  const showUI = ready && !bridging;
  const holeActive = spotlightTarget != null;

  // Overlay steps collapse the cutout to a point so spotlight steps can
  // expand/glide from center (or from the previous target) instead of popping.
  const hole = holeFromTarget(spotlightTarget);

  return createPortal(
    <>
      {bridging && (
        <div
          className="nuzlocke-tour-bridge"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="nuzlocke-tour-bridge-card gba-frame">
            <div className="gba-frame-title nuzlocke-tour-bridge-title">
              <span>Tour</span>
              <span className="nuzlocke-tour-bridge-pulse" aria-hidden />
            </div>
            <div className="nuzlocke-tour-bridge-body">
              <div className="nuzlocke-tour-bridge-spinner" aria-hidden />
              <div>
                <p className="nuzlocke-tour-bridge-heading">
                  Continuing the tour…
                </p>
                <p className="nuzlocke-tour-bridge-copy">
                  Loading the next screen.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUI && (
        <div className="nuzlocke-tour-layer">
          <div
            className={`nuzlocke-tour-scrim ${holeActive ? "is-dim" : "is-on"}`}
          />
          <div
            className={`nuzlocke-tour-hole ${holeActive ? "is-on" : "is-off"}`}
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
            }}
          />
        </div>
      )}

      {showUI && (
        <div
          data-tour-popover=""
          role="dialog"
          aria-modal="true"
          aria-labelledby="nuzlocke-tour-title"
          className={`nuzlocke-tour-popover ${moving ? "is-moving" : ""}`}
          style={popoverStyle}
        >
          <header className="nuzlocke-tour-chrome">
            <p className="nuzlocke-tour-chrome-label">
              Tour · {stepIndex + 1} of {ONBOARDING_STEPS.length}
            </p>
            <button
              type="button"
              className="nuzlocke-tour-skip"
              onClick={finish}
            >
              Skip
            </button>
          </header>

          <div className="nuzlocke-tour-progress" aria-hidden>
            {ONBOARDING_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={
                  i <= stepIndex
                    ? "nuzlocke-tour-progress-seg is-active"
                    : "nuzlocke-tour-progress-seg"
                }
              />
            ))}
          </div>

          <div key={contentKey} className="nuzlocke-tour-copy is-enter">
            <h2 id="nuzlocke-tour-title" className="nuzlocke-tour-title">
              {step.title}
            </h2>
            <p className="nuzlocke-tour-description">{step.description}</p>
            {step.signature && (
              <div className="nuzlocke-tour-signature">
                <Image
                  src={step.signature.avatarUrl}
                  alt=""
                  width={48}
                  height={48}
                  className="nuzlocke-tour-signature-avatar"
                  unoptimized
                />
                <p className="nuzlocke-tour-signature-label">
                  {step.signature.label}
                </p>
              </div>
            )}
          </div>

          <footer className="nuzlocke-tour-footer">
            <button
              type="button"
              className={`${CTA_SECONDARY_SM} disabled:opacity-40`}
              disabled={isFirst || moving}
              onClick={() => goToStep(stepIndex - 1)}
            >
              Back
            </button>
            <button
              type="button"
              className={CTA_PRIMARY_SM}
              disabled={moving}
              onClick={() => {
                if (isLast) finish();
                else goToStep(stepIndex + 1);
              }}
            >
              {isLast ? "Let's go!" : "Next →"}
            </button>
          </footer>
        </div>
      )}
    </>,
    document.body,
  );
}
