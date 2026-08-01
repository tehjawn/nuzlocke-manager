import type { CSSProperties, ReactNode } from "react";
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
  cardBackgroundKey = null,
  "data-tour": dataTour,
}: FrameProps) {
  const dataBg = cardBackgroundDataAttr(cardBackgroundKey);
  const customUrl = cardBackgroundCustomUrl(cardBackgroundKey);
  const style = customUrl
    ? ({
        ["--card-bg-custom" as string]: cssTextureUrl(customUrl),
      } as CSSProperties)
    : undefined;

  return (
    <section
      data-tour={dataTour}
      data-card-bg={dataBg}
      style={style}
      className={`gba-frame overflow-hidden ${tone === "rip" ? "bg-rip" : ""} ${className}`}
    >
      {title ? (
        <header className="gba-frame-title relative z-[1] flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:text-base">
          {/* min-w-0 without truncate: ReactNode titles (e.g. count suffixes) shouldn't ellipsis mid-number */}
          <span className="min-w-0 font-semibold">{title}</span>
          {actions ? (
            <div className="relative z-[1] flex shrink-0 items-center gap-1.5">
              {actions}
            </div>
          ) : null}
        </header>
      ) : null}
      <div
        className={`relative z-[1] ${dense ? "p-2.5 sm:p-3" : "p-4 sm:p-5"}`}
      >
        {children}
      </div>
    </section>
  );
}
