import type { SearchSeasonContext } from "@/features/search/search-types";

/**
 * Compact "where am I?" snippet for Ask drawer (#300).
 *
 * Built only from the pathname + season Fuse context already in memory —
 * never scrapes the DOM or sends HTML to the model.
 */

const STORAGE_KEY = "ask:include-page-context";
const FALLEN_SLOT = "GRAVEYARD";
const MAX_PAGE_CONTEXT_CHARS = 1_200;

export function readIncludePageContextPref(defaultOn = true): boolean {
  if (typeof window === "undefined") return defaultOn;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    // ignore
  }
  return defaultOn;
}

export function writeIncludePageContextPref(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // ignore
  }
}

function formatPartyLine(
  mons: SearchSeasonContext["trainers"][number]["pokemon"],
  living: boolean,
): string {
  const list = mons
    .filter((m) =>
      living ? m.slot !== FALLEN_SLOT : m.slot === FALLEN_SLOT,
    )
    .slice(0, living ? 8 : 6)
    .map((m) => {
      const name = m.nickname?.trim() || m.species;
      const lv = typeof m.level === "number" ? ` Lv${m.level}` : "";
      return `${name} (${m.species}${lv})`;
    });
  return list.length ? list.join(", ") : "(none)";
}

/**
 * Returns a short PAGE CONTEXT block, or null when the route has nothing
 * useful to add (global pages without a season, etc.).
 */
export function buildPageContext(
  pathname: string,
  season: SearchSeasonContext | null,
): string | null {
  const path = pathname.split("?")[0] || "/";

  if (!season) {
    if (path === "/" || path === "") return "PAGE: Home";
    if (path.startsWith("/about")) return "PAGE: About";
    if (path.startsWith("/account")) return "PAGE: Account";
    if (path.startsWith("/login")) return "PAGE: Login";
    if (path.startsWith("/challenges") && path === "/challenges") {
      return "PAGE: Seasons index";
    }
    return `PAGE: ${path}`;
  }

  const base = `/challenges/${season.slug}`;
  const lines: string[] = [
    `PAGE: ${season.name}`,
    `PATH: ${path}`,
  ];

  if (path === base || path === `${base}/`) {
    lines.push("VIEW: Trainers board (league overview)");
  } else if (path.startsWith(`${base}/me`)) {
    const me = season.trainers.find((t) => t.id === season.myTrainerId);
    lines.push(
      me
        ? `VIEW: My Trainer (${me.handle})`
        : "VIEW: My Trainer (no board claimed)",
    );
    if (me) {
      lines.push(`team: ${formatPartyLine(me.pokemon, true)}`);
      lines.push(`badges: ${me.earnedBadgeKeys.length}`);
    }
  } else if (path.startsWith(`${base}/trainers/`)) {
    const id = path.slice(`${base}/trainers/`.length).split("/")[0];
    const trainer = season.trainers.find((t) => t.id === id);
    if (trainer) {
      lines.push(`VIEW: Trainer board — ${trainer.handle}`);
      lines.push(`team: ${formatPartyLine(trainer.pokemon, true)}`);
      lines.push(`fallen: ${formatPartyLine(trainer.pokemon, false)}`);
      lines.push(`badges: ${trainer.earnedBadgeKeys.length}`);
      if (trainer.statusText?.trim()) {
        lines.push(`status: ${trainer.statusText.trim().slice(0, 80)}`);
      }
    } else {
      lines.push("VIEW: Trainer board (unknown trainer)");
    }
  } else if (path.startsWith(`${base}/rules`)) {
    lines.push("VIEW: Rules / FAQ");
    const titles = season.rules
      .slice(0, 6)
      .map((r) => r.title?.trim() || "Untitled rule")
      .filter(Boolean);
    if (titles.length) lines.push(`rules: ${titles.join("; ")}`);
  } else if (path.startsWith(`${base}/encounters`)) {
    lines.push("VIEW: Catch Map");
  } else if (path.startsWith(`${base}/setup`)) {
    lines.push("VIEW: Setup / get started");
  } else if (path.startsWith(`${base}/gm`)) {
    lines.push("VIEW: GM console");
  } else if (path.startsWith(`${base}/about`)) {
    lines.push("VIEW: Season about");
  } else if (path.startsWith(`${base}/tournament`)) {
    lines.push("VIEW: Tournament / Ladder");
  } else if (/\/season-stats|\/memorial|\/stats/.test(path)) {
    lines.push("VIEW: Season stats / memorial");
  } else if (path.includes("/tools")) {
    const tool = path.split("/tools/")[1]?.split("/")[0];
    lines.push(tool ? `VIEW: Tools · ${tool}` : "VIEW: Tools hub");
  } else {
    lines.push(`VIEW: ${path.replace(base, "") || "season"}`);
  }

  const block = lines.join("\n");
  return block.length > MAX_PAGE_CONTEXT_CHARS
    ? `${block.slice(0, MAX_PAGE_CONTEXT_CHARS - 1)}…`
    : block;
}

/** Merge page context above the season digest for the Ask API snapshot. */
export function prependPageContext(
  snapshot: string | null,
  pageContext: string | null,
): string | null {
  if (!pageContext?.trim()) return snapshot;
  const pageBlock = [
    "<<<PAGE_CONTEXT",
    pageContext.trim(),
    "PAGE_CONTEXT",
  ].join("\n");
  if (!snapshot?.trim()) return pageBlock;
  return `${pageBlock}\n\n${snapshot}`;
}
