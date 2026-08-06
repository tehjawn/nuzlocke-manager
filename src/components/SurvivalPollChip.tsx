"use client";

import type { ReactNode } from "react";
import type { SurvivalPollTally } from "@/lib/survival-market-types";

type IconProps = { className?: string };

const iconBase = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const;

/** Flat flame — crowd leans Survive. */
function SurviveFlameIcon({ className = "h-3 w-3" }: IconProps) {
  return (
    <svg {...iconBase} className={className}>
      <path
        d="M12 3c1.2 2.4 0 4.2-1.4 5.6C9.2 10 8 11.2 8 13.4c0 2.4 1.8 4.1 4 4.1s4-1.7 4-4.1c0-2.6-1.8-3.8-2.8-5.6C12.5 6.5 12.2 4.8 12 3z"
        strokeLinejoin="round"
      />
      <path
        d="M12 17.5c1.1 0 2-.8 2-2 0-1.1-.9-1.8-2-2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Flat bomb — crowd leans Die. */
function DieBombIcon({ className = "h-3 w-3" }: IconProps) {
  return (
    <svg {...iconBase} className={className}>
      <circle cx="12" cy="14" r="6" />
      <path
        d="M14.2 8.6l1.6-1.6M15.8 7l1.4.4M17.2 8.4l.4 1.4"
        strokeLinecap="round"
      />
      <path d="M12 11.5v5M9.5 14h5" strokeLinecap="round" />
    </svg>
  );
}

/** Flat praying hands — Survive/Die nearly even. */
function SplitPrayIcon({ className = "h-3 w-3" }: IconProps) {
  return (
    <svg {...iconBase} className={className}>
      <path
        d="M10.2 4.5L7.5 9.2c-.4.7-.3 1.5.2 2l1.8 1.8v6.2c0 .5.4.9.9.9h.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.8 4.5l2.7 4.7c.4.7.3 1.5-.2 2l-1.8 1.8v6.2c0 .5-.4.9-.9.9h-.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.5 12.5l1.5 1 1.5-1" strokeLinecap="round" strokeLinejoin="round" />
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

const SENTIMENT_STYLE: Record<
  SurvivalSentiment,
  { className: string; Icon: (props: IconProps) => ReactNode; label: string }
> = {
  survive: {
    className: "text-accent-deep",
    Icon: SurviveFlameIcon,
    label: "Crowd leans Survive",
  },
  die: {
    className: "text-danger",
    Icon: DieBombIcon,
    label: "Crowd leans Die",
  },
  split: {
    className: "text-muted",
    Icon: SplitPrayIcon,
    label: "Crowd is split",
  },
};

/**
 * Corner mark for all-trainers party slots — flame / bomb / pray by vote lean.
 * Renders nothing when there are no votes (or the poll was voided).
 */
export function SurvivalSentimentIcon({
  poll,
  className = "",
}: {
  poll: SurvivalPollTally;
  className?: string;
}) {
  const sentiment = survivalSentimentFromPoll(poll);
  if (!sentiment) return null;

  const { className: colorClass, Icon, label } = SENTIMENT_STYLE[sentiment];
  const title = sentimentTitle(poll, sentiment);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-sm bg-surface-2/80 p-px drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)] ${colorClass} ${className}`}
      title={title}
      aria-label={title}
      role="img"
    >
      <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      <span className="sr-only">{label}</span>
    </span>
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
