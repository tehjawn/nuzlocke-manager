import type { ReactNode } from "react";

type TrainerStatsSummaryProps = {
  caught: number;
  fallen: number;
  badgesEarned: number;
  badgesTotal: number;
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
  badgesEarned,
  badgesTotal,
  updatedAt,
}: TrainerStatsSummaryProps) {
  const rows: Array<{
    label: string;
    value: string;
    icon: ReactNode;
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
      label: "Badges",
      value: `${badgesEarned}/${badgesTotal}`,
      icon: <BadgesIcon />,
    },
    {
      label: "Updated",
      value: formatUpdatedDay(updatedAt),
      icon: <UpdatedIcon />,
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
      {rows.map((row) => (
        <div
          key={row.label}
          className="gba-inset flex items-center gap-2.5 bg-surface-2/70 px-3 py-2"
        >
          <span className="shrink-0 text-muted/80">{row.icon}</span>
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold tracking-tight text-muted">
              {row.label}
            </dt>
            <dd className="text-lg font-bold leading-tight tracking-tight">
              {row.value}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
