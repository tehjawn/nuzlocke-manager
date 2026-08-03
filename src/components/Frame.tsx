"use client";

import {
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
  /** Curated or custom TrainerCard background; omit / null = default fill. */
  cardBackgroundKey?: string | null;
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

export function Frame({
  title,
  actions,
  children,
  className = "",
  tone = "default",
  dense = false,
  collapsible = false,
  defaultOpen = true,
  cardBackgroundKey = null,
  "data-tour": dataTour,
}: FrameProps) {
  // React 19 DOM types no longer include defaultOpen on <details>; keep an
  // uncontrolled-style initial open via local state + the open attribute.
  const [open, setOpen] = useState(defaultOpen);
  const dataBg = cardBackgroundDataAttr(cardBackgroundKey);
  const customUrl = cardBackgroundCustomUrl(cardBackgroundKey);
  const style = customUrl
    ? ({
        ["--card-bg-custom" as string]: cssTextureUrl(customUrl),
      } as CSSProperties)
    : undefined;

  const shellClass = `gba-frame overflow-hidden ${
    tone === "rip" ? "bg-rip" : ""
  } ${className}`;
  const bodyClass = `relative z-[1] ${
    dense ? "p-2.5 sm:p-3" : "p-4 sm:p-5"
  }`;
  const actionsNode = actions ? (
    <div className="relative z-[1] flex shrink-0 items-center gap-1.5">
      {actions}
    </div>
  ) : null;

  function handleToggle(event: ToggleEvent<HTMLDetailsElement>) {
    setOpen(event.currentTarget.open);
  }

  if (collapsible && title) {
    return (
      <details
        data-tour={dataTour}
        data-card-bg={dataBg}
        style={style}
        className={`${shellClass} open:[&_.frame-chevron]:rotate-90`}
        open={open}
        onToggle={handleToggle}
      >
        <summary className="gba-frame-title relative z-[1] flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm sm:text-base [&::-webkit-details-marker]:hidden">
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
      {title ? (
        <header className="gba-frame-title relative z-[1] flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:text-base">
          {/* min-w-0 without truncate: ReactNode titles (e.g. count suffixes) shouldn't ellipsis mid-number */}
          <span className="min-w-0 font-semibold">{title}</span>
          {actionsNode}
        </header>
      ) : null}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}
