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
import { usePathname, useRouter } from "next/navigation";
import { CTA_PRIMARY_SM, CTA_SECONDARY_SM } from "@/lib/cta";
import {
  ONBOARDING_STEPS,
  clearOnboardingStep,
  readOnboardingStep,
  readOnboardingTransition,
  writeOnboardingStep,
  writeOnboardingTransition,
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

// Client-only flag (portals need `document.body`) without a mount effect —
// false during SSR/first paint, true once React reads live browser state.
const noopSubscribe = () => () => {};
const getIsClient = () => true;
const getIsServer = () => false;

function waitForElement(
  selector: string,
  timeoutMs = 5000,
): Promise<Element | null> {
  const existing = document.querySelector(selector);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const el = document.querySelector(selector);
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

async function prepareTarget(
  selector: string | undefined,
  opts?: { instantScroll?: boolean },
): Promise<Rect | null> {
  if (!selector) {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    return null;
  }

  const el = await waitForElement(selector);
  if (!el) return null;

  el.scrollIntoView({
    behavior: opts?.instantScroll ? "instant" : "smooth",
    block: "center",
    inline: "nearest",
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
  const width = Math.min(POPOVER_WIDTH, vw - VIEW_MARGIN * 2);

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

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

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
    setBridging(false);
    setReady(false);
    readyRef.current = false;
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
    // Re-hydrate from sessionStorage on (re)open — this reads an external
    // store, it doesn't derive from props/state, so it belongs in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStepIndex(readOnboardingStep());
    if (readOnboardingTransition()) setBridging(true);
  }, [open]);

  useEffect(() => {
    if (!open) {
      // Tear down to the closed state — also syncs the sessionStorage
      // transition flag, so this has to run as an effect, not during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady(false);
      readyRef.current = false;
      setTarget(null);
      setMoving(false);
      writeOnboardingTransition(false);
      setBridging(false);
      return;
    }

    let cancelled = false;
    const active = ONBOARDING_STEPS[stepIndex];
    if (!active) {
      finish();
      return;
    }

    if (!active.match(pathname)) {
      beginBridge();
      router.push(active.href);
      return;
    }

    const stayVisible = readyRef.current && !readOnboardingTransition();

    void (async () => {
      if (!stayVisible) setMoving(false);

      const rect = await prepareTarget(active.element, {
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
      const el = document.querySelector(step.element!);
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
  const hole = spotlightTarget
    ? {
        top: Math.max(0, spotlightTarget.top - PAD),
        left: Math.max(0, spotlightTarget.left - PAD),
        width: spotlightTarget.width + PAD * 2,
        height: spotlightTarget.height + PAD * 2,
      }
    : {
        top: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
        left: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
        width: 0,
        height: 0,
      };

  return createPortal(
    <>
      {bridging ? (
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
      ) : null}

      {showUI ? (
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
      ) : null}

      {showUI ? (
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
      ) : null}
    </>,
    document.body,
  );
}
