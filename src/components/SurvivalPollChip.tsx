"use client";

import type { ReactNode } from "react";
import type { SurvivalPollTally } from "@/lib/survival-market-types";

type IconProps = { className?: string };

/**
 * Heavier than the icon set's usual 1.75 — these glyphs are pure line work at
 * ~12px, with no interior detail to muddy, so the extra weight only helps.
 */
const iconBase = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.25,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** Up arrow — crowd leans Survive. */
function SurviveArrowIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={`pokemon-survival-sentiment__svg ${className}`}>
      <path d="M12 19V5.5" />
      <path d="M6 11.5L12 5.5L18 11.5" />
    </svg>
  );
}

/** Down arrow — crowd leans Die. */
function DieArrowIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={`pokemon-survival-sentiment__svg ${className}`}>
      <path d="M12 5v13.5" />
      <path d="M6 12.5L12 18.5L18 12.5" />
    </svg>
  );
}

/** Tilde — Survive/Die nearly even. */
function SplitTildeIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={`pokemon-survival-sentiment__svg ${className}`}>
      <path d="M4 12C6.2 8.6 9.2 8.6 12 12C14.8 15.4 17.8 15.4 20 12" />
    </svg>
  );
}

/** Within this band of 50% Survive, treat the crowd as split. */
const SPLIT_BAND_PCT = 8;

export type SurvivalSentiment = "survive" | "die" | "split";

export function survivalSentimentFromPoll(
  poll: Pick<SurvivalPollTally, "survive" | "die" | "total" | "status">,
): SurvivalSentiment | null {
  if (poll.total <= 0) return null;
  if (poll.status === "VOID") return null;

  const survivePct = Math.round((poll.survive / poll.total) * 100);
  if (Math.abs(survivePct - 50) <= SPLIT_BAND_PCT) return "split";
  return survivePct > 50 ? "survive" : "die";
}

function sentimentTitle(
  poll: SurvivalPollTally,
  sentiment: SurvivalSentiment,
): string {
  const survivePct = Math.round((poll.survive / poll.total) * 100);
  const diePct = 100 - survivePct;
  const votes = `${poll.total} vote${poll.total === 1 ? "" : "s"}`;

  if (poll.status === "RESOLVED_SURVIVE") {
    return `Lived · ${survivePct}% called Survive (${votes})`;
  }
  if (poll.status === "RESOLVED_DIE") {
    return `Died · ${diePct}% called Die (${votes})`;
  }

  if (sentiment === "survive") {
    return `${survivePct}% Survive · ${votes}`;
  }
  if (sentiment === "die") {
    return `${diePct}% Die · ${votes}`;
  }
  return `${survivePct}% Survive / ${diePct}% Die · ${votes}`;
}

const SENTIMENT_ICON: Record<
  SurvivalSentiment,
  (props: IconProps) => ReactNode
> = {
  survive: SurviveArrowIcon,
  die: DieArrowIcon,
  split: SplitTildeIcon,
};

const SENTIMENT_LABEL: Record<SurvivalSentiment, string> = {
  survive: "Crowd leans Survive",
  die: "Crowd leans Die",
  split: "Crowd is split",
};

/**
 * Beginner-facing Survive/Die line under the sprite — % + lean, matching the
 * catch / bond label rows. Null when there is nothing to show.
 */
export function survivalSentimentLabel(
  poll: SurvivalPollTally,
): string | null {
  const sentiment = survivalSentimentFromPoll(poll);
  if (!sentiment) return null;

  const survivePct = Math.round((poll.survive / poll.total) * 100);
  const diePct = 100 - survivePct;

  if (poll.status === "RESOLVED_SURVIVE") {
    return `Lived · ${survivePct}% called Survive`;
  }
  if (poll.status === "RESOLVED_DIE") {
    return `Died · ${diePct}% called Die`;
  }
  if (sentiment === "survive") return `${survivePct}% Survive`;
  if (sentiment === "die") return `${diePct}% Die`;
  return `Split · ${survivePct}% / ${diePct}%`;
}

/** Label tone class — same tint family as the corner glyph. */
export function survivalSentimentToneClass(
  sentiment: SurvivalSentiment,
): string {
  return `pokemon-survival-label--${sentiment}`;
}

/**
 * Corner mark for all-trainers party slots — green ↑ / yellow ~ / red ↓ by vote
 * lean. Paired visually with {@link BondHeart} (mirrored bottom-left).
 * Renders nothing when there are no votes (or the poll was voided).
 */
export function SurvivalSentimentIcon({
  poll,
  className = "pokemon-survival-sentiment--corner-dense h-3 w-3 sm:h-3.5 sm:w-3.5",
}: {
  poll: SurvivalPollTally;
  className?: string;
}) {
  const sentiment = survivalSentimentFromPoll(poll);
  if (!sentiment) return null;

  const Icon = SENTIMENT_ICON[sentiment];
  const title = sentimentTitle(poll, sentiment);

  return (
    <span
      className={`pokemon-survival-sentiment pokemon-survival-sentiment--${sentiment} ${className}`}
      title={title}
      aria-label={title}
      role="img"
    >
      <Icon className="h-full w-full" />
      <span className="sr-only">{SENTIMENT_LABEL[sentiment]}</span>
    </span>
  );
}

/**
 * Icon + meaning for details / hover preview.
 * - `inline` — icon left of text (slot cards)
 * - `chip` — bordered row for the details modal
 * - `tile` — icon over text for the hover grade strip
 */
export function SurvivalSentimentCaption({
  poll,
  variant = "inline",
  className = "",
  iconClassName,
}: {
  poll: SurvivalPollTally;
  variant?: "inline" | "chip" | "tile";
  className?: string;
  iconClassName?: string;
}) {
  const sentiment = survivalSentimentFromPoll(poll);
  const label = survivalSentimentLabel(poll);
  if (!sentiment || !label) return null;

  const Icon = SENTIMENT_ICON[sentiment];
  const title = sentimentTitle(poll, sentiment);
  const tone = survivalSentimentToneClass(sentiment);
  const iconSize =
    iconClassName ??
    (variant === "tile" ? "h-4 w-4 shrink-0" : "h-3.5 w-3.5 shrink-0");

  const icon = (
    <span
      aria-hidden
      className={`pokemon-survival-sentiment pokemon-survival-sentiment--${sentiment} inline-flex shrink-0 ${iconSize}`}
    >
      <Icon className="h-full w-full" />
    </span>
  );
  const text = (
    <span
      className={`min-w-0 ${
        variant === "tile"
          ? "text-center text-[10px] font-semibold leading-tight tracking-tight"
          : "truncate text-[11px] font-semibold tracking-tight"
      } ${tone}`}
    >
      {label}
    </span>
  );

  if (variant === "tile") {
    return (
      <div
        className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md border border-frame/45 bg-surface-2/90 px-1 py-1.5 ${className}`}
        title={title}
      >
        {icon}
        {text}
      </div>
    );
  }

  if (variant === "chip") {
    return (
      <p
        className={`inline-flex w-full max-w-full items-center gap-1.5 rounded-md border border-frame/45 bg-surface-2/90 px-2 py-1.5 ${className}`}
        title={title}
      >
        {icon}
        {text}
      </p>
    );
  }

  return (
    <p
      className={`inline-flex max-w-full items-center justify-center gap-1 sm:justify-start ${className}`}
      title={title}
    >
      {icon}
      {text}
    </p>
  );
}

/** Compact Survive/Die tally for board / league sprites. */
export function SurvivalPollChip({
  poll,
  compact = false,
}: {
  poll: SurvivalPollTally;
  compact?: boolean;
}) {
  if (poll.total <= 0 && poll.status === "OPEN") return null;

  let label: string;
  if (poll.status === "RESOLVED_DIE") {
    const n = poll.die;
    label = compact
      ? `${n}/${poll.total} ✓`
      : `Died · ${n}/${poll.total} called it`;
  } else if (poll.status === "RESOLVED_SURVIVE") {
    const n = poll.survive;
    label = compact
      ? `${n}/${poll.total} ✓`
      : `Lived · ${n}/${poll.total} called it`;
  } else if (poll.status === "VOID") {
    label = compact ? "Void" : "Poll voided";
  } else {
    const pct = Math.round((poll.survive / poll.total) * 100);
    label = compact
      ? `${pct}% live`
      : `${pct}% Survive · ${poll.total}`;
  }

  return (
    <span
      className="inline-flex max-w-full truncate rounded-md border border-frame/50 bg-surface-2/95 px-1.5 py-0.5 text-[9px] font-semibold leading-none tracking-tight text-ink/90 shadow-sm"
      title={label}
    >
      {label}
    </span>
  );
}
