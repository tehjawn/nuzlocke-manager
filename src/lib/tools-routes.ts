export type ToolsId =
  | "guide"
  | "pokedex"
  | "bounty"
  | "markets"
  | "planner"
  | "stats"
  | "chart";

/**
 * Crest Pulse token roles used for per-tool icon chips (nav + hub). Keeps
 * scan-color identity without inventing new brand hues. Each catalog entry
 * must use a distinct tone so the submenu / hub stay scannable.
 */
export type ToolsTone =
  | "accent"
  | "accent-2"
  | "warn"
  | "interactive"
  | "danger"
  | "discord"
  | "rip"
  | "muted";

export type ToolsCatalogEntry = {
  id: ToolsId;
  title: string;
  /** One-line nav/hub scan label — not the marketing blurb. */
  navLabel: string;
  tone: ToolsTone;
  blurb: string;
};

/**
 * Single source of truth for tool order — the hub grid, the header Tools menu,
 * and the mobile drawer all render straight off this array, so adding a tool
 * never needs a nav edit. Progress-first (what do I do next, who has what),
 * then the lookup references.
 */
export const TOOLS_CATALOG: ReadonlyArray<ToolsCatalogEntry> = [
  {
    id: "guide",
    title: "Game Guide",
    navLabel: "Next story gates",
    tone: "accent",
    blurb:
      "What to do next in Modern Emerald — story gates and easy-to-miss beats based on your badges.",
  },
  {
    id: "pokedex",
    title: "Pokédex",
    navLabel: "Species & tiers",
    tone: "danger",
    blurb:
      "Species directory — role, F→S BST ranks vs the ROM, matchups, ownership — plus BST and competitive tier ladders.",
  },
  {
    id: "bounty",
    title: "Pokémon Ownership",
    navLabel: "Who owns what",
    tone: "accent-2",
    blurb:
      "Every Modern Emerald species — who's owned it, who's just seen it, who's cornered a line.",
  },
  {
    id: "markets",
    title: "Survive / Die",
    navLabel: "Crowd takes",
    tone: "warn",
    blurb:
      "Season-wide survival polls — weigh in on living party and box mons, then see who called it when they fall or clear.",
  },
  {
    id: "chart",
    title: "Type Chart",
    navLabel: "Matchup table",
    tone: "discord",
    blurb:
      "Modern 18-type attack × defense multipliers — overlay a trainer's Main Squad coverage.",
  },
  {
    id: "planner",
    title: "Team Planner",
    navLabel: "Coverage & prep",
    tone: "interactive",
    blurb:
      "Sandbox a Main of 6 — type coverage, defensive holes, and Elite Four / gym prep.",
  },
  {
    id: "stats",
    title: "Season Stats",
    navLabel: "Season leaderboards",
    tone: "rip",
    blurb:
      "Hall of fame — badge race, graves & wipes, god catches, shinies, and every season-wide leaderboard.",
  },
];

export function toolsHubHref(slug: string): string {
  return `/challenges/${slug}/tools`;
}

/**
 * Canonical Season Stats home (issue #288) — lives at `/season-stats`. Tools
 * catalog / old `?tool=stats` and `/memorial` links alias here.
 */
export function seasonStatsHref(
  slug: string,
  query?: { section?: string | null },
): string {
  const base = `/challenges/${slug}/season-stats`;
  const section = parseStatsSection(query?.section);
  if (!section) return base;
  return `${base}?${new URLSearchParams({ section }).toString()}`;
}

export function toolsHref(
  slug: string,
  tool: ToolsId,
  query?: {
    id?: string | number | null;
    chapter?: string | null;
    mode?: string | null;
    section?: string | null;
  },
): string {
  // Stats graduated out of Tools into its own season tab — keep callers
  // (Encounters deep links, catalog cards) pointing at the canonical URL.
  if (tool === "stats") {
    return seasonStatsHref(slug, { section: query?.section });
  }
  const params = new URLSearchParams({ tool });
  if (query?.id != null && query.id !== "") {
    params.set("id", String(query.id));
  }
  if (query?.chapter) params.set("chapter", query.chapter);
  if (query?.mode) params.set("mode", query.mode);
  if (query?.section) params.set("section", query.section);
  return `/challenges/${slug}/tools?${params.toString()}`;
}

/** Accept `tool=` (preferred) or legacy `tab=`. */
export function parseToolsId(
  tool: string | null | undefined,
  tab: string | null | undefined = null,
): ToolsId | null {
  const raw = tool ?? tab;
  if (
    raw === "guide" ||
    raw === "pokedex" ||
    raw === "bounty" ||
    raw === "markets" ||
    raw === "planner" ||
    raw === "stats" ||
    raw === "chart"
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

export type BountyMode = "tracker" | "exclusives" | "showcase";

export function parseBountyMode(
  raw: string | null | undefined,
): BountyMode {
  // "open"/"gaps" are pre-tracker-merge URLs — both land on the tracker,
  // which now covers both via the trainer + status filters.
  if (raw === "exclusives" || raw === "showcase") return raw;
  return "tracker";
}

export type PlannerMode = "coverage" | "prep" | "vs" | "recommended";

export function parsePlannerMode(
  raw: string | null | undefined,
): PlannerMode {
  if (raw === "prep" || raw === "vs" || raw === "recommended") return raw;
  return "coverage";
}

/** Directory (briefing) is the default; tiers = BST ladder; competitive = curated viability. */
export type PokedexMode = "briefing" | "tiers" | "competitive";

export function parsePokedexMode(
  raw: string | null | undefined,
): PokedexMode {
  if (raw === "tiers" || raw === "competitive") return raw;
  return "briefing";
}

/**
 * Season Stats page sections. Deep links use `?section=` rather than a `#hash`
 * so scroll survives Suspense / streaming boundaries — SeasonStatsView reads
 * the param reactively and scrolls itself once the section is mounted.
 */
export type StatsSection = "standings" | "quality" | "species" | "memorial";

export function parseStatsSection(
  raw: string | null | undefined,
): StatsSection | null {
  if (
    raw === "standings" ||
    raw === "quality" ||
    raw === "species" ||
    raw === "memorial"
  ) {
    return raw;
  }
  return null;
}

/** DOM id of a Season Stats section — single source for links and anchors. */
export function statsSectionId(section: StatsSection): string {
  return `season-stats-${section}`;
}
