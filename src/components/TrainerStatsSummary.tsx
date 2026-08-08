import type { ReactNode } from "react";
import { formatPokedollars } from "@/lib/gen3-save/money";
import { formatPlayTime } from "@/lib/gen3-save/playtime";

type TrainerStatsSummaryProps = {
  caught: number;
  fallen: number;
    /**
   * Open-slot catch failures with no species on that route (fled / failed / released).
   * Null when save flags have not been imported yet.
   */
  spentRoutes: number | null;
  badgesEarned: number;
  badgesTotal: number;
  /** 1-based attempt on the board right now — the durable count, not closed wipes. */
  runNumber: number;
  /** Run is finished and the next one hasn't started; the board is the final team. */
  runEnded?: boolean;
  /** Championship finishes this season. */
  completions: number;
  money: number | null;
  /** Gen 3 playtime in whole seconds; null when never imported. */
  playTimeSeconds: number | null;
  updatedAt: string | null;
};

function formatUpdatedDay(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type IconProps = { className?: string };

const iconBase = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const;

/** Circular arrow — attempts, not failures. */
function RunsIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={className}>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" strokeLinecap="round" />
      <path d="M20 4v4.5h-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Champion's laurel — runs finished, not restarted. */
function CompletionsIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={className}>
      <path d="M8.5 4.5v5a3.5 3.5 0 0 0 7 0v-5h-7z" strokeLinejoin="round" />
      <path
        d="M8.5 6H6a2.5 2.5 0 0 0 2.5 2.5M15.5 6H18a2.5 2.5 0 0 1-2.5 2.5"
        strokeLinejoin="round"
      />
      <path d="M12 13v3.5M9 19.5h6" strokeLinecap="round" />
    </svg>
  );
}

/** Poké Ball–ish mark for caught count. */
function CaughtIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={className}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M3.75 12h16.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.25" />
    </svg>
  );
}

function RipIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={className}>
      <path
        d="M6 20V6.5c0-.8.5-1.5 1.3-1.7L12 3.5l4.7 1.3c.8.2 1.3.9 1.3 1.7V20"
        strokeLinejoin="round"
      />
      <path d="M9.5 10.5h5M9.5 14h5" strokeLinecap="round" />
    </svg>
  );
}

/** Dotted Poké Ball — catch failed with no Pokémon on file. */
function CatchFailedIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={className}>
      <circle
        cx="12"
        cy="12"
        r="8.25"
        strokeDasharray="2.25 2.5"
        strokeLinecap="round"
      />
      <path
        d="M3.75 12h16.5"
        strokeLinecap="round"
        strokeDasharray="2.25 2.5"
      />
      <circle
        cx="12"
        cy="12"
        r="2.25"
        strokeDasharray="1.5 1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BadgesIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={className}>
      <path
        d="M12 3.5l2.1 4.3 4.7.7-3.4 3.3.8 4.7L12 14.3 7.8 16.5l.8-4.7-3.4-3.3 4.7-.7L12 3.5z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoneyIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={className}>
      <circle cx="12" cy="12" r="8.25" />
      <path
        d="M12 7.5v9M9.75 9.25c.5-.7 1.3-1 2.25-1 1.4 0 2.5.7 2.5 1.9s-1.1 1.85-2.5 1.85h-1c-1.4 0-2.5.7-2.5 1.9 0 1.2 1.15 1.9 2.55 1.9.95 0 1.75-.3 2.25-1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlayTimeIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={className}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5v5l3 1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UpdatedIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={className}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 9.5h16" strokeLinecap="round" />
      <path d="M8 3.5v3M16 3.5v3" strokeLinecap="round" />
    </svg>
  );
}

export function TrainerStatsSummary({
  caught,
  fallen,
  spentRoutes,
  badgesEarned,
  badgesTotal,
  runNumber,
  runEnded = false,
  completions,
  money,
  playTimeSeconds,
  updatedAt,
}: TrainerStatsSummaryProps) {
  const badgesComplete = badgesTotal > 0 && badgesEarned === badgesTotal;

  const rows: Array<{
    label: string;
    value: string;
    icon: ReactNode;
    complete?: boolean;
    title?: string;
  }> = [
    {
      label: "Caught",
      value: String(caught),
      icon: <CaughtIcon />,
    },
    {
      label: "R.I.P.",
      value: String(fallen),
      icon: <RipIcon />,
    },
    {
      label: "Catches failed",
      value: spentRoutes != null ? String(spentRoutes) : "—",
      icon: <CatchFailedIcon />,
      title:
        spentRoutes != null
          ? "Routes flagged spent in the save with no owned Pokémon (party, box, or memorial) from that slot. Re-import after progress to refresh."
          : "Import a Modern Emerald save to mark catch-failed routes from encounter flags.",
    },
    {
      label: badgesComplete ? "All badges" : "Badges",
      value: `${badgesEarned}/${badgesTotal}`,
      icon: <BadgesIcon />,
      complete: badgesComplete,
    },
    {
      label: runEnded ? "Run (finished)" : "Run",
      value: String(runNumber),
      icon: <RunsIcon />,
    },
    {
      label: "Completions",
      value: String(completions),
      icon: <CompletionsIcon />,
      complete: completions > 0,
    },
    {
      label: "Money",
      value: money != null ? formatPokedollars(money) : "—",
      icon: <MoneyIcon />,
    },
    {
      label: "Playtime",
      value:
        playTimeSeconds != null ? formatPlayTime(playTimeSeconds) : "—",
      icon: <PlayTimeIcon />,
    },
    {
      label: "Updated",
      value: formatUpdatedDay(updatedAt),
      icon: <UpdatedIcon />,
    },
  ];

  return (
    <dl className="gba-inset divide-y divide-frame/35 overflow-hidden bg-surface-2/70">
      {rows.map((row) => (
        <div
          key={row.label}
          title={row.title}
          className={`flex items-center justify-between gap-3 px-3 py-2 ${
            row.complete ? "trainer-stat--badges-complete" : ""
          }`}
        >
          <dt
            className={`flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight ${
              row.complete ? "text-accent-2-ink" : "text-muted"
            }`}
          >
            <span
              className={`shrink-0 ${
                row.complete ? "text-accent-2-ink" : "text-muted/80"
              }`}
            >
              {row.icon}
            </span>
            {row.label}
          </dt>
          <dd className="shrink-0 text-base font-bold tabular-nums tracking-tight">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
