"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type ToggleEvent,
} from "react";
import {
  cardBackgroundCustomUrl,
  cardBackgroundDataAttr,
} from "@/data/card-backgrounds";
import { cssTextureUrl } from "@/lib/custom-texture";

type FrameProps = {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "default" | "rip";
  /** Tighter padding for compact cards (e.g. trainers grid). */
  dense?: boolean;
  /** Title toggles body visibility (native disclosure). */
  collapsible?: boolean;
  /** Initial open state when collapsible (default true). */
  defaultOpen?: boolean;
  /** Controlled open state when collapsible (overrides internal state). */
  open?: boolean;
  /** Fires when the disclosure opens/closes. */
  onOpenChange?: (open: boolean) => void;
  /** Curated or custom TrainerCard background; omit / null = default frame fill. */
  cardBackgroundKey?: string | null;
  /**
   * Absolute chrome pinned to the frame shell (e.g. corner ribbon), outside
   * the padded body so it sits flush with the rounded border.
   */
  overlay?: ReactNode;
  /** Spotlight target for the first-run onboarding tour. */
  "data-tour"?: string;
};

/** Frame header with a muted count, e.g. Main Squad (6). */
export function frameCountTitle(label: string, count: number): ReactNode {
  return (
    <>
      {label}{" "}
      <span className="font-medium tabular-nums text-muted">({count})</span>
    </>
  );
}

/**
 * Mid-page disclosures (Reserves / R.I.P.) insert height above later siblings.
 * Browser scroll anchoring then walks the viewport down the new content. Pin the
 * summary's viewport Y across open + deferred hydrate so the header stays put
 * (same feel as Encountered, which only grows the document end).
 */
function restoreSummaryScrollPin(
  summary: HTMLElement | null,
  pinRef: { current: number | null },
) {
  if (!summary || pinRef.current == null) return;
  const delta = summary.getBoundingClientRect().top - pinRef.current;
  if (Math.abs(delta) > 0.5) {
    window.scrollBy(0, delta);
  }
  pinRef.current = summary.getBoundingClientRect().top;
}

export function Frame({
  title,
  actions,
  children,
  className = "",
  tone = "default",
  dense = false,
  collapsible = false,
  defaultOpen = true,
  open: openControlled,
  onOpenChange,
  cardBackgroundKey = null,
  overlay = null,
  "data-tour": dataTour,
}: FrameProps) {
  // React 19 DOM types no longer include defaultOpen on <details>; keep an
  // uncontrolled-style initial open via local state + the open attribute.
  const [openUncontrolled, setOpenUncontrolled] = useState(defaultOpen);
  const controlled = openControlled !== undefined;
  const open = controlled ? openControlled : openUncontrolled;
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const summaryRef = useRef<HTMLElement | null>(null);
  const summaryPinRef = useRef<number | null>(null);
  const dataBg = cardBackgroundDataAttr(cardBackgroundKey);
  const customUrl = cardBackgroundCustomUrl(cardBackgroundKey);
  const style = customUrl
    ? ({
        ["--card-bg-custom" as string]: cssTextureUrl(customUrl),
      } as CSSProperties)
    : undefined;

  // Native <details> toggles itself on click. When controlled and the parent
  // recomputes the same `open` value, React may skip the attribute update —
  // force the DOM back in sync (ref writes must not happen during render).
  useEffect(() => {
    if (!controlled) return;
    const node = detailsRef.current;
    if (node && node.open !== open) node.open = open;
  }, [controlled, open]);

  // Capture summary Y before the next commit that changes open/body; restore
  // after layout so skeleton → strip (and re-open with cached data) don't jump.
  // While closed, keep a pin ready for controlled open (no click capture).
  useLayoutEffect(() => {
    if (!collapsible) return;
    const summary = summaryRef.current;
    if (open) {
      restoreSummaryScrollPin(summary, summaryPinRef);
    } else if (summary) {
      summaryPinRef.current = summary.getBoundingClientRect().top;
    }
    return () => {
      // Refresh pin only while open (hydrate / children swap). Do not overwrite
      // the closed-state pin after the open commit — that top is already jumped.
      if (open && summary) {
        summaryPinRef.current = summary.getBoundingClientRect().top;
      }
    };
  }, [collapsible, open, children]);

  const shellClass = `gba-frame overflow-hidden ${
    tone === "rip" ? "bg-rip" : ""
  } ${className}`;
  const bodyClass = `relative z-[1] ${dense ? "p-2.5 sm:p-3" : "p-4 sm:p-5"}`;
  const actionsNode = actions ? (
    <div className="relative z-[1] flex shrink-0 items-center gap-1.5">
      {actions}
    </div>
  ) : null;

  function captureSummaryPin() {
    const summary = summaryRef.current;
    if (summary) {
      summaryPinRef.current = summary.getBoundingClientRect().top;
    }
  }

  function handleToggle(event: ToggleEvent<HTMLDetailsElement>) {
    const next = event.currentTarget.open;
    if (!controlled) setOpenUncontrolled(next);
    onOpenChange?.(next);
    // Native open already grew the body (and may have scroll-anchored) before
    // React re-renders — correct synchronously so the first paint stays put.
    if (next) {
      restoreSummaryScrollPin(summaryRef.current, summaryPinRef);
    } else {
      captureSummaryPin();
    }
  }

  if (collapsible && title) {
    return (
      <details
        ref={detailsRef}
        data-tour={dataTour}
        data-card-bg={dataBg}
        style={style}
        className={`${shellClass} [overflow-anchor:none] open:[&_.frame-chevron]:rotate-90`}
        open={open}
        onToggle={handleToggle}
      >
        {overlay}
        <summary
          ref={summaryRef}
          className="gba-frame-title relative z-[1] flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm sm:text-base [&::-webkit-details-marker]:hidden"
          onClickCapture={captureSummaryPin}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="frame-chevron text-xs text-muted transition-transform"
            >
              ▸
            </span>
            {/* min-w-0 without truncate: ReactNode titles (e.g. count suffixes) shouldn't ellipsis mid-number */}
            <span className="min-w-0 font-semibold">{title}</span>
          </span>
          {actionsNode}
        </summary>
        <div className={bodyClass}>{children}</div>
      </details>
    );
  }

  return (
    <section
      data-tour={dataTour}
      data-card-bg={dataBg}
      style={style}
      className={shellClass}
    >
      {overlay}
      {title && (
        <header className="gba-frame-title relative z-[1] flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:text-base">
          {/* min-w-0 without truncate: ReactNode titles (e.g. count suffixes) shouldn't ellipsis mid-number */}
          <span className="min-w-0 font-semibold">{title}</span>
          {actionsNode}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}
