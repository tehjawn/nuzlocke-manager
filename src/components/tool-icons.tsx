/**
 * Per-tool glyphs, keyed by `ToolsId`. Shared by every surface that renders
 * `TOOLS_CATALOG` — the Tools hub grid, the header Tools menu, and the mobile
 * nav drawer — so a new tool needs one icon here and nothing in the nav.
 * The hub/rail glyph for Tools itself is `ToolsIcon` in `nav-icons.tsx`.
 */

import type { ToolsId } from "@/lib/tools-routes";

type IconProps = { className?: string };

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
    case "bounty":
      return <OwnershipToolIcon className={className} />;
    case "planner":
      return <PlannerToolIcon className={className} />;
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

export function PlannerToolIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9.5h8M8 12.5h5M8 15.5h6" strokeLinecap="round" />
      <circle cx="16.5" cy="15.5" r="1.25" fill="currentColor" stroke="none" />
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
