"use client";

import type { SurvivalPollTally } from "@/lib/survival-market-types";

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
