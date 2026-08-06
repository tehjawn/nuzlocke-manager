import type { AskSurfaceId } from "@/features/search/ask-types";
import type { SearchResult } from "@/features/search/search-types";

/**
 * Resolve declared Ask surfaces to real Jump results (#300).
 * Omit missing surfaces (e.g. My Trainer when unsigned-in / no board).
 */

const SURFACE_MATCHERS: Record<
  AskSurfaceId,
  (r: SearchResult) => boolean
> = {
  trainers: (r) => r.category === "navigate" && r.title === "Trainers",
  rules: (r) =>
    (r.category === "navigate" || r.category === "rules") &&
    (r.title === "Rules / FAQ" || r.title === "Rules"),
  faq: (r) =>
    r.category === "navigate" &&
    (r.title === "FAQ" || r.href?.includes("tab=faq") === true),
  my_trainer: (r) =>
    r.category === "navigate" && r.title === "My Trainer",
  game_guide: (r) =>
    (r.category === "guide" || r.category === "navigate") &&
    r.title === "Game Guide",
  setup: (r) => r.category === "navigate" && r.title === "Setup",
  tools: (r) =>
    r.category === "navigate" &&
    (r.title === "Tools" || r.title.startsWith("Tools ·")),
};

export function resolveAskSurfaces(
  surfaces: AskSurfaceId[],
  results: SearchResult[],
): SearchResult[] {
  const picked: SearchResult[] = [];
  const seen = new Set<string>();

  for (const surface of surfaces) {
    const match = results.find((r) => {
      if (seen.has(r.id)) return false;
      return SURFACE_MATCHERS[surface](r);
    });
    if (!match?.href) continue;
    seen.add(match.id);
    picked.push(match);
  }

  return picked;
}
