export type ToolsId = "pokedex" | "chart" | "compare" | "guide" | "bounty";

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
    blurb: "Modern 18-type attack × defense multipliers with hover scanning.",
  },
  {
    id: "compare",
    title: "Compare",
    blurb: "Side-by-side trainer squads and badge cases for any two boards.",
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
      "What’s still free game in Modern Emerald — open bounties, your gaps, and pack exclusives.",
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
    a?: string | null;
    b?: string | null;
    chapter?: string | null;
    mode?: string | null;
  },
): string {
  const params = new URLSearchParams({ tool });
  if (query?.id != null && query.id !== "") {
    params.set("id", String(query.id));
  }
  if (query?.a) params.set("a", query.a);
  if (query?.b) params.set("b", query.b);
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
    raw === "compare" ||
    raw === "guide" ||
    raw === "bounty"
  ) {
    return raw;
  }
  return null;
}

export function toolsTitle(tool: ToolsId | null): string {
  if (!tool) return "Tools";
  return TOOLS_CATALOG.find((t) => t.id === tool)?.title ?? "Tools";
}

export type BountyMode = "open" | "gaps" | "exclusives";

export function parseBountyMode(
  raw: string | null | undefined,
): BountyMode {
  if (raw === "gaps" || raw === "exclusives") return raw;
  return "open";
}
