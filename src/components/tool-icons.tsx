/**
 * Per-tool glyphs, keyed by `ToolsId`. Shared by every surface that renders
 * `TOOLS_CATALOG` — the Tools hub grid, the header Tools menu, and the mobile
 * nav drawer — so a new tool needs one icon here and nothing in the nav.
 * The hub/rail glyph for Tools itself is `ToolsIcon` in `nav-icons.tsx`.
 */

import {
  TOOLS_CATALOG,
  type ToolsId,
  type ToolsTone,
} from "@/lib/tools-routes";

type IconProps = { className?: string };

/** Soft chip fill + ink from existing Crest Pulse tokens. */
export const TOOL_TONE_CHIP: Record<ToolsTone, string> = {
  accent: "border-accent/40 bg-accent/15 text-accent-deep",
  "accent-2": "border-accent-2/50 bg-accent-2/20 text-ink",
  warn: "border-warn/50 bg-warn/15 text-warn",
  interactive: "border-interactive/45 bg-interactive-soft text-interactive",
  danger: "border-danger/40 bg-danger/12 text-danger",
  discord: "border-discord/40 bg-discord/15 text-discord",
  rip: "border-accent-deep/35 bg-rip text-accent-deep",
  relic: "border-relic/45 bg-relic-soft text-relic",
  muted: "border-frame bg-surface-2 text-muted",
};

export function toolsTone(id: ToolsId): ToolsTone {
  return TOOLS_CATALOG.find((t) => t.id === id)?.tone ?? "muted";
}

/** Color-coded icon tile used in nav menus and the Tools hub/workspace. */
export function ToolChip({
  id,
  className = "",
  iconClassName = "h-4 w-4",
}: {
  id: ToolsId;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${TOOL_TONE_CHIP[toolsTone(id)]} ${className}`}
      aria-hidden
    >
      <ToolIcon id={id} className={iconClassName} />
    </span>
  );
}

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const;

export function ToolIcon({
  id,
  className = "h-5 w-5",
}: IconProps & { id: ToolsId }) {
  switch (id) {
    case "guide":
      return <GuideToolIcon className={className} />;
    case "pokedex":
      return <PokedexToolIcon className={className} />;
    case "itemdex":
      return <ItemDexToolIcon className={className} />;
    case "bounty":
      return <OwnershipToolIcon className={className} />;
    case "markets":
      return <SurviveDieToolIcon className={className} />;
    case "planner":
      return <PlannerToolIcon className={className} />;
    case "stats":
      return <SeasonStatsToolIcon className={className} />;
    case "chart":
      return <TypeChartToolIcon className={className} />;
  }
}

/** Map / checklist mark for the Game Guide. */
export function GuideToolIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M5.5 5.5l4.5-1.5 4 1.5 4.5-1.5v14.5l-4.5 1.5-4-1.5-4.5 1.5V5.5z"
        strokeLinejoin="round"
      />
      <path d="M10 4.5v14M14 5.5v14" strokeLinecap="round" />
      <path d="M7.5 10.5h1.5M7.5 13.5h1.5" strokeLinecap="round" />
    </svg>
  );
}

export function PokedexToolIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <circle cx="12" cy="11" r="3.25" />
      <path d="M9.5 17.5h5" strokeLinecap="round" />
    </svg>
  );
}

/** Cut gem — the ItemDex, and the only faceted shape in the set. */
export function ItemDexToolIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M7.5 4h9l3.5 5-8 11-8-11z"
        strokeLinejoin="round"
      />
      <path d="M4 9h16" strokeLinecap="round" />
      <path d="M9.75 9L12 4.25 14.25 9 12 20z" strokeLinejoin="round" />
    </svg>
  );
}

export function OwnershipToolIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="7.25" />
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 2.75v2.5M12 18.75v2.5M2.75 12h2.5M18.75 12h2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Flame — Survive/Die crowd takes. */
export function SurviveDieToolIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
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

export function PlannerToolIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9.5h8M8 12.5h5M8 15.5h6" strokeLinecap="round" />
      <circle cx="16.5" cy="15.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Trophy for the Season Stats hall of fame. */
export function SeasonStatsToolIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 4.5h8v4.25a4 4 0 01-8 0z" strokeLinejoin="round" />
      <path d="M8 6.25H5.25a2.9 2.9 0 002.95 2.9M16 6.25h2.75a2.9 2.9 0 01-2.95 2.9" />
      <path d="M12 12.75v2.5M9.75 18.5c0-1.5 1-2.5 2.25-2.5s2.25 1 2.25 2.5" />
      <path d="M8.5 19.5h7" strokeLinecap="round" />
    </svg>
  );
}

export function TypeChartToolIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
    </svg>
  );
}
