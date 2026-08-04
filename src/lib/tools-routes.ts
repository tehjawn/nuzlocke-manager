export type ToolsId =
  | "pokedex"
  | "chart"
  | "guide"
  | "bounty"
  | "planner";

export const TOOLS_CATALOG: ReadonlyArray<{
  id: ToolsId;
  title: string;
  blurb: string;
}> = [
  {
    id: "pokedex",
    title: "Pokédex",
    blurb:
      "Search species — sprite, typing, base stats, matchups, and counters from your Main + Reserve.",
  },
  {
    id: "chart",
    title: "Type Chart",
    blurb:
      "Modern 18-type attack × defense multipliers — overlay a trainer's Main Squad coverage.",
  },
  {
    id: "guide",
    title: "Game Guide",
    blurb:
      "What to do next in Modern Emerald — story gates and easy-to-miss beats based on your badges.",
  },
  {
    id: "bounty",
    title: "Bounty Hunter",
    blurb:
      "Every Modern Emerald species — who's owned it, who's just seen it, who's cornered a line.",
  },
  {
    id: "planner",
    title: "Team Planner",
    blurb:
      "Sandbox a Main of 6 — type coverage, defensive holes, and Elite Four / gym prep.",
  },
];

export function toolsHubHref(slug: string): string {
  return `/challenges/${slug}/tools`;
}

export function toolsHref(
  slug: string,
  tool: ToolsId,
  query?: {
    id?: string | number | null;
    chapter?: string | null;
    mode?: string | null;
  },
): string {
  const params = new URLSearchParams({ tool });
  if (query?.id != null && query.id !== "") {
    params.set("id", String(query.id));
  }
  if (query?.chapter) params.set("chapter", query.chapter);
  if (query?.mode) params.set("mode", query.mode);
  return `/challenges/${slug}/tools?${params.toString()}`;
}

/** Accept `tool=` (preferred) or legacy `tab=`. */
export function parseToolsId(
  tool: string | null | undefined,
  tab: string | null | undefined = null,
): ToolsId | null {
  const raw = tool ?? tab;
  if (
    raw === "pokedex" ||
    raw === "chart" ||
    raw === "guide" ||
    raw === "bounty" ||
    raw === "planner"
  ) {
    return raw;
  }
  return null;
}

export function toolsTitle(tool: ToolsId | null): string {
  if (!tool) return "Tools";
  return TOOLS_CATALOG.find((t) => t.id === tool)?.title ?? "Tools";
}

/**
 * Compare was folded into Team Planner's vs Trainer mode. Its old links —
 * `?tool=compare` and the bare `?a=&b=` pairs the tool used to share — should
 * land on the Planner instead of the hub.
 */
export function isLegacyCompareUrl(query: {
  a?: string | null;
  b?: string | null;
  tab?: string | null;
  tool?: string | null;
}): boolean {
  if (parseToolsId(query.tool, query.tab)) return false;
  return (query.tool ?? query.tab) === "compare" || Boolean(query.a || query.b);
}

/** Planner's pairwise mode — `a`/`b` are dropped rather than ported onto it. */
export function legacyCompareHref(slug: string): string {
  return toolsHref(slug, "planner", { mode: "vs" });
}

export type BountyMode = "tracker" | "exclusives";

export function parseBountyMode(
  raw: string | null | undefined,
): BountyMode {
  // "open"/"gaps" are pre-tracker-merge URLs — both land on the tracker,
  // which now covers both via the trainer + status filters.
  if (raw === "exclusives") return raw;
  return "tracker";
}

export type PlannerMode = "coverage" | "prep" | "vs";

export function parsePlannerMode(
  raw: string | null | undefined,
): PlannerMode {
  if (raw === "prep" || raw === "vs") return raw;
  return "coverage";
}
