import Fuse, { type IFuseOptions } from "fuse.js";
import { EMERALD_GUIDE } from "@/features/guide/emerald-guide";
import { guideChapterLabel } from "@/features/guide/guide-gym-prep";
import type {
  SearchFuseHit,
  SearchResult,
  SearchSeasonContext,
} from "@/features/search/search-types";
// Digest, not `@/data/items` — this module is mounted from the root layout, so
// the ~100 KB catalog would ship on every page for a palette most sessions
// never open. `heldItemSpriteUrl` is free here: `lib/sprites` already pulls
// `pokemon-index` into this bundle.
import { ITEM_SEARCH_ROWS } from "@/data/items-lite.generated";
import { heldItemSpriteUrl } from "@/data/pokemon-index";
import { avatarImageUrl } from "@/lib/sprites";
import { toolsHref, seasonStatsHref } from "@/lib/tools-routes";

const FUSE_OPTIONS: IFuseOptions<SearchResult> = {
  keys: [
    // Title carries most of the intent; tags now outrank subtitle because
    // subtitle is mostly descriptive filler ("Season 2026 · League board")
    // while tags hold handles, species, and route names people actually type.
    { name: "title", weight: 0.6 },
    { name: "tags", weight: 0.28 },
    { name: "subtitle", weight: 0.12 },
  ],
  // Tighter than the old 0.4: at 0.4 three-letter queries pulled in most of the
  // index, which is what made results feel arbitrary.
  threshold: 0.34,
  ignoreLocation: true,
  // Match indices are expensive on large indexes; Jump highlights are nice-to-have.
  includeMatches: false,
  includeScore: true,
  // 1 matched a single character anywhere — pure noise on a large index.
  minMatchCharLength: 2,
};

const RECENT_KEY = "nuzlocke-search-recents";
/** Pre-rename key — read once, then migrate to RECENT_KEY. */
const LEGACY_RECENT_KEY = "nuzlocke-jump-recents";
/** id → { n: times chosen, t: last chosen epoch ms } for result ranking. */
const USAGE_KEY = "nuzlocke-search-usage";
const MAX_RECENTS = 6;
const MAX_RESULTS = 24;
const MAX_USAGE_ENTRIES = 60;

const SLOT_LABEL: Record<string, string> = {
  MAIN: "Party",
  RESERVE: "Reserve",
  GRAVEYARD: "Memorial",
  ENCOUNTERED: "Encountered",
};

export function buildGlobalResults(): SearchResult[] {
  return [
    {
      id: "nav-home",
      title: "Home",
      subtitle: "League landing",
      href: "/",
      category: "navigate",
      tags: ["home", "start", "landing"],
    },
    {
      id: "nav-about",
      title: "About",
      subtitle: "How the manager works",
      href: "/about",
      category: "navigate",
      tags: ["about", "help", "info"],
    },
    {
      id: "nav-account",
      title: "Account",
      subtitle: "Profile settings",
      href: "/account",
      category: "navigate",
      tags: ["account", "profile", "settings"],
    },
    {
      id: "nav-login",
      title: "Log in",
      subtitle: "Discord sign-in",
      href: "/login",
      category: "navigate",
      tags: ["login", "sign in", "discord", "auth"],
    },
    {
      id: "action-open-ask",
      title: "Open Gomi AI",
      subtitle: "Ask about this season",
      category: "action",
      tags: ["ask", "gomi", "ai", "chat", "assistant", "help", "drawer"],
      action: "open-ask",
    },
    {
      id: "action-theme",
      title: "Toggle theme",
      subtitle: "Switch light / dark",
      category: "action",
      tags: ["theme", "dark", "light", "mode", "appearance"],
      action: "toggle-theme",
    },
  ];
}

/** Season-scoped verbs for Jump's Actions group (#308). */
function buildSeasonActions(ctx: SearchSeasonContext): SearchResult[] {
  if (!ctx.myTrainerId) return [];
  const actions: SearchResult[] = [
    {
      id: `action-import-${ctx.slug}`,
      title: "Import Save",
      subtitle: "Upload a .sav to update your board",
      category: "action",
      tags: ["import", "save", "upload", "sav", "import save", "file"],
      action: "import-save",
    },
    {
      id: `action-export-${ctx.slug}`,
      title: "Export team",
      subtitle: "Copy living roster for notes / LLM",
      category: "action",
      tags: ["export", "team", "copy", "roster", "llm", "paste"],
      action: "export-team",
    },
    {
      id: `action-copy-link-${ctx.slug}`,
      title: "Copy board link",
      subtitle: "Share your trainer board URL",
      category: "action",
      tags: ["copy", "link", "share", "url", "board"],
      action: "copy-board-link",
    },
  ];
  return actions;
}

function seasonSectionTabs(slug: string, status: string, isGm: boolean) {
  const base = `/challenges/${slug}`;
  const tabs = [
    { href: `${base}/about`, label: "About" },
    { href: `${base}/rules`, label: "Rules / FAQ" },
    { href: base, label: "Trainers" },
    { href: `${base}/encounters`, label: "Encounters" },
    { href: `${base}/tools`, label: "Tools" },
    { href: seasonStatsHref(slug), label: "Season Stats" },
  ];
  // TEMP (#240): Tournament / Ladder is still WIP — GMs only.
  if (isGm) {
    const tournamentLabel = status === "TOURNAMENT" ? "Ladder" : "Tournament";
    tabs.push({ href: `${base}/tournament`, label: tournamentLabel });
  }
  return tabs;
}

export function buildSeasonResults(ctx: SearchSeasonContext): SearchResult[] {
  const base = `/challenges/${ctx.slug}`;

  // First-run funnel: only Setup + My Trainer (+ board actions). GMs are
  // excluded from firstRun by the layout predicate.
  if (ctx.firstRun) {
    const navigate: SearchResult[] = [
      {
        id: `nav-setup-${ctx.slug}`,
        title: "Setup",
        subtitle: `${ctx.name} · Get started`,
        href: `${base}/setup`,
        category: "navigate",
        tags: ["setup", "onboarding", "get started"],
      },
    ];
    if (ctx.myTrainerId) {
      navigate.push({
        id: `nav-me-${ctx.slug}`,
        title: "My Trainer",
        subtitle: "Go to your board",
        href: `${base}/me`,
        category: "navigate",
        tags: ["me", "my board", "my trainer", "self"],
      });
    }
    return [...navigate, ...buildSeasonActions(ctx)];
  }

  const tabs = seasonSectionTabs(ctx.slug, ctx.status, ctx.showGm);

  const navigate: SearchResult[] = [
    {
      id: `nav-season-${ctx.slug}`,
      title: ctx.name,
      subtitle: `Season ${ctx.year} · League board`,
      href: base,
      category: "navigate",
      tags: ["season", "league", "board", ctx.name, String(ctx.year)],
    },
    ...tabs.map((tab) => ({
      id: `nav-tab-${tab.href}`,
      title: tab.label,
      subtitle: `${ctx.name} · ${tab.label}`,
      href: tab.href,
      category: "navigate" as const,
      tags:
        tab.label === "Season Stats"
          ? [
              "season stats",
              "memorial",
              "graves",
              "wipes",
              "leaderboard",
              "standings",
              "hall of fame",
              "records",
              "richest",
              "badges",
              "god",
              "shiny",
              "tools",
            ]
          : [tab.label.toLowerCase(), "section", "tab"],
    })),
    {
      id: `nav-faq-${ctx.slug}`,
      title: "FAQ",
      subtitle: `${ctx.name} · Frequently asked`,
      href: `${base}/rules?tab=faq`,
      category: "navigate",
      tags: ["faq", "help", "questions"],
    },
    {
      id: `nav-setup-${ctx.slug}`,
      title: "Setup",
      subtitle: `${ctx.name} · Get started`,
      href: `${base}/setup`,
      category: "navigate",
      tags: ["setup", "onboarding", "get started"],
    },
  ];

  if (ctx.myTrainerId) {
    navigate.push({
      id: `nav-me-${ctx.slug}`,
      title: "My Trainer",
      subtitle: "Go to your board",
      href: `${base}/me`,
      category: "navigate",
      tags: ["me", "my board", "my trainer", "self"],
    });
  }

  if (ctx.showGm) {
    navigate.push({
      id: `nav-gm-${ctx.slug}`,
      title: "GM Console",
      subtitle: `${ctx.name} · Game Master tools`,
      href: `${base}/gm`,
      category: "navigate",
      tags: ["gm", "game master", "admin", "console"],
    });
  }

  const trainers: SearchResult[] = ctx.trainers.map((t) => {
    const badges = t.earnedBadgeKeys ?? [];
    const mons = t.pokemon ?? [];
    const living = mons.filter((m) => m.slot !== "GRAVEYARD");
    const fallen = mons.filter((m) => m.slot === "GRAVEYARD");
    const badgeCount = badges.length;
    const monCount = living.length;
    const fallenCount = fallen.length;
    const subtitleParts = [
      t.realName?.trim() || t.discordDisplayName?.trim() || null,
      badgeCount ? `${badgeCount} badge${badgeCount === 1 ? "" : "s"}` : null,
      monCount ? `${monCount} Pokémon` : null,
      fallenCount
        ? `${fallenCount} fallen`
        : null,
      t.statusText?.trim() || null,
    ].filter(Boolean);

    return {
      id: `trainer-${t.id}`,
      title: t.handle,
      subtitle: subtitleParts.join(" · ") || "Trainer board",
      href: `${base}/trainers/${t.id}`,
      category: "trainer" as const,
      tags: [
        t.handle,
        t.realName ?? "",
        t.discordUsername ?? "",
        t.discordDisplayName ?? "",
        "trainer",
        "player",
        fallenCount ? "rip" : "",
        fallenCount ? "memorial" : "",
        fallenCount ? "fallen" : "",
      ].filter(Boolean),
      imageUrl: avatarImageUrl(t.avatarSpriteKey),
    };
  });

  // Living party only in the Fuse index. GRAVEYARD stays on `season` for Jump
  // Ask digests; related chips build memorial rows lazily after an answer.
  const pokemon: SearchResult[] = ctx.trainers.flatMap((t) => {
    const living = (t.pokemon ?? []).filter((m) => m.slot !== "GRAVEYARD");
    return living.map((mon) => {
      const label = mon.nickname?.trim() || mon.species;
      const slot = SLOT_LABEL[mon.slot] ?? mon.slot;
      const bits = [
        mon.nickname?.trim() ? mon.species : null,
        slot,
        mon.catchRoute?.trim() || null,
        mon.level != null ? `Lv ${mon.level}` : null,
        t.handle,
      ].filter(Boolean);

      return {
        id: `pokemon-${mon.id}`,
        title: label,
        subtitle: bits.join(" · "),
        href: `${base}/trainers/${t.id}?pokemon=${encodeURIComponent(mon.id)}`,
        category: "pokemon" as const,
        tags: [
          mon.species,
          mon.nickname ?? "",
          mon.catchRoute ?? "",
          t.handle,
          slot,
          mon.isShiny ? "shiny" : "",
          "pokemon",
          "mon",
        ].filter(Boolean),
        pokemonSprite: {
          pokedexId: mon.pokedexId,
          shiny: mon.isShiny,
          species: mon.species,
        },
      };
    });
  });

  // The digest is already scoped to items someone would hunt — evolution gates
  // and wild holds. Indexing all 343 bag rows (every TM, Mail and key item)
  // would drown the palette for no one's benefit.
  const items: SearchResult[] = ITEM_SEARCH_ROWS.map((item) => {
    const bits = [
      item.evolution ? "Evolution item" : null,
      item.holdOnly ? "Wild hold only" : null,
      item.holders.length > 0
        ? `Held by ${item.holders.slice(0, 3).join(", ")}`
        : null,
    ].filter(Boolean);
    return {
      id: `item-${item.slug}`,
      title: item.name,
      subtitle: bits.join(" · "),
      href: toolsHref(ctx.slug, "itemdex", { item: item.slug }),
      category: "item" as const,
      imageUrl: heldItemSpriteUrl(item.slug),
      tags: [
        item.slug.replace(/-/g, " "),
        "item",
        "itemdex",
        ...(item.evolution ? ["evolve", "evolution"] : []),
        ...item.holders,
        ...item.wheres,
      ],
    };
  });

  const badges: SearchResult[] = ctx.badges.map((b) => ({
    id: `badge-${b.key}`,
    title: b.label,
    subtitle: [b.leaderName?.trim(), b.category].filter(Boolean).join(" · "),
    href: base,
    category: "badge" as const,
    tags: [b.label, b.key, b.leaderName ?? "", b.category, "badge", "gym"],
  }));

  const rules: SearchResult[] = [
    ...ctx.rules.map((r) => ({
      id: `rule-${r.id}`,
      title: r.title?.trim() || "Rule",
      subtitle: truncate(r.body, 80),
      href: `${base}/rules`,
      category: "rules" as const,
      tags: [r.title ?? "", r.body, "rule"],
    })),
    ...ctx.faqs.map((f) => ({
      id: `faq-${f.id}`,
      title: f.question,
      subtitle: truncate(f.answer, 80),
      href: `${base}/rules?tab=faq`,
      category: "rules" as const,
      tags: [f.question, f.answer, "faq"],
    })),
  ];

  const guide: SearchResult[] = [
    {
      id: `guide-hub-${ctx.slug}`,
      title: "Game Guide",
      subtitle: `${ctx.name} · What to do next`,
      href: toolsHref(ctx.slug, "guide"),
      category: "guide",
      tags: [
        "guide",
        "game guide",
        "walkthrough",
        "next steps",
        "steven",
        "rock smash",
        "rusturf",
        "dive",
        "modern emerald",
        "tools",
      ],
    },
    ...EMERALD_GUIDE.chapters.map((chapter) => {
      const postGame = chapter.section === "post-game";
      const chapterLabel = postGame
        ? `Post-game · ${chapter.title}`
        : guideChapterLabel(chapter);
      return {
        id: `guide-chapter-${chapter.id}`,
        title: chapterLabel,
        subtitle: truncate(chapter.summary, 80),
        href: toolsHref(ctx.slug, "guide", { chapter: chapter.id }),
        category: "guide" as const,
        tags: [
          chapterLabel,
          chapter.title,
          chapter.summary,
          "guide",
          "chapter",
          ...(postGame
            ? ["post-game", "optional"]
            : [`ch ${chapter.sortOrder + 1}`]),
          ...chapter.requiresBadges,
        ],
      };
    }),
    ...EMERALD_GUIDE.steps
      .filter((s) => s.priority === "critical")
      .map((step) => ({
        id: `guide-step-${step.id}`,
        title: step.title,
        subtitle: truncate(step.summary, 80),
        href: toolsHref(ctx.slug, "guide", { chapter: step.chapterId }),
        category: "guide" as const,
        tags: [
          step.title,
          step.summary,
          step.detail ?? "",
          "guide",
          ...(step.hms ?? []),
          ...(step.keyItems ?? []),
          ...(step.locations ?? []),
        ],
      })),
  ];

  return [
    ...navigate,
    ...buildSeasonActions(ctx),
    ...trainers,
    ...pokemon,
    ...items,
    ...badges,
    ...rules,
    ...guide,
    {
      id: `bounty-${ctx.slug}`,
      title: "Pokémon Ownership",
      subtitle: `${ctx.name} · Owned, seen & exclusives`,
      href: toolsHref(ctx.slug, "bounty"),
      category: "navigate" as const,
      tags: [
        "ownership",
        "owned",
        "untouched",
        // Kept so the tool's old name still finds it for anyone with the
        // muscle memory — the rename is user-facing copy, not a new entry.
        "bounty",
        "hunter",
        "missing",
        "exclusives",
        "gaps",
        "modern emerald",
        "tools",
        "encounters",
      ],
    },
    {
      id: `itemdex-${ctx.slug}`,
      title: "ItemDex",
      subtitle: `${ctx.name} · Items & where they drop`,
      href: toolsHref(ctx.slug, "itemdex"),
      category: "navigate" as const,
      tags: [
        "item",
        "items",
        "itemdex",
        "evolution",
        "evolve",
        "stone",
        "held item",
        "where to find",
        "tools",
      ],
    },
    {
      id: `markets-${ctx.slug}`,
      title: "Survive / Die",
      subtitle: `${ctx.name} · Crowd survival polls`,
      href: toolsHref(ctx.slug, "markets"),
      category: "navigate" as const,
      tags: [
        "survive",
        "die",
        "survival",
        "poll",
        "prediction",
        "market",
        "vote",
        "hot take",
        "tools",
      ],
    },
    {
      id: `planner-${ctx.slug}`,
      title: "Team Planner",
      subtitle: `${ctx.name} · Coverage & League prep`,
      href: toolsHref(ctx.slug, "planner"),
      category: "navigate" as const,
      tags: [
        "team",
        "planner",
        "coverage",
        "elite four",
        "champion",
        "type",
        "pvp",
        "gym",
        "tools",
      ],
    },
  ];
}

/**
 * Memorial (GRAVEYARD) Pokémon for Ask-related chips only — not Fuse-indexed.
 * Keeps Jump Ask "jump to BigHead" working without bloating fuzzy search.
 */
export function buildSeasonMemorialResults(
  ctx: SearchSeasonContext,
): SearchResult[] {
  if (ctx.firstRun) return [];
  const base = `/challenges/${ctx.slug}`;
  return ctx.trainers.flatMap((t) =>
    (t.pokemon ?? [])
      .filter((mon) => mon.slot === "GRAVEYARD")
      .map((mon) => {
        const label = mon.nickname?.trim() || mon.species;
        const bits = [
          mon.nickname?.trim() ? mon.species : null,
          "Memorial",
          mon.catchRoute?.trim() || null,
          mon.level != null ? `Lv ${mon.level}` : null,
          t.handle,
        ].filter(Boolean);

        return {
          id: `pokemon-${mon.id}`,
          title: label,
          subtitle: bits.join(" · "),
          href: `${base}/trainers/${t.id}?pokemon=${encodeURIComponent(mon.id)}`,
          category: "pokemon" as const,
          tags: [
            mon.species,
            mon.nickname ?? "",
            mon.catchRoute ?? "",
            t.handle,
            "Memorial",
            "rip",
            "fallen",
            mon.isShiny ? "shiny" : "",
            "pokemon",
            "mon",
          ].filter(Boolean),
          pokemonSprite: {
            pokedexId: mon.pokedexId,
            shiny: mon.isShiny,
            species: mon.species,
          },
        };
      }),
  );
}

export function createSearchIndex(results: SearchResult[]) {
  return new Fuse(results, FUSE_OPTIONS);
}

/** Fuse scores are 0 (perfect) → 1 (worst); shave up to 40% off for familiarity. */
const MAX_USAGE_BOOST = 0.4;
const USAGE_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;

function usageBoost(entry: UsageEntry | undefined, now: number): number {
  if (!entry) return 0;
  // Frequency saturates fast — the 6th pick shouldn't outweigh a better match.
  const frequency = Math.min(entry.n, 6) / 6;
  // Recency decays smoothly so last month's habits stop dominating.
  const age = Math.max(0, now - entry.t);
  const recency = Math.pow(0.5, age / USAGE_HALF_LIFE_MS);
  return MAX_USAGE_BOOST * (0.6 * frequency + 0.4 * recency);
}

export function querySearchIndex(
  index: Fuse<SearchResult>,
  query: string,
): SearchFuseHit[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Bitap + ignoreLocation scales badly with query length. Long NL asks are for
  // Jump Ask — running Fuse for them just stalls keystrokes for empty hits.
  if (shouldSkipFuzzySearch(trimmed)) return [];

  const usage = getUsageStats();
  // `Date.now()` in a Client Component is a prerender error under
  // cacheComponents, so only reach for the clock once we know there is
  // usage history to rank against (always empty during SSR).
  const hasUsage = Object.keys(usage).length > 0;
  const now = hasUsage ? Date.now() : 0;

  // Cap Fuse work early; we only ever show ≤ MAX_RESULTS after usage re-rank.
  return index
    .search(trimmed, { limit: MAX_RESULTS * 2 })
    .map((hit) => {
      const base = hit.score ?? 1;
      return {
        hit,
        // Lower is better, so a boost subtracts from the score.
        ranked: base * (1 - usageBoost(usage[hit.item.id], now)),
      };
    })
    .sort((a, b) => a.ranked - b.ranked)
    .slice(0, MAX_RESULTS)
    .map(({ hit }) => ({ item: hit.item }));
}

/**
 * Fuse is for short lookup keys (handles, species, pages). Natural-language
 * questions thrash Bitap and almost never produce useful hits.
 */
export function shouldSkipFuzzySearch(query: string): boolean {
  // Bitap cost grows fast with length — bail earlier than "full sentence".
  if (query.length >= 24) return true;
  if (query.split(/\s+/).filter(Boolean).length >= 4) return true;
  // "who is …" / "what are …" — Ask owns these; Fuse returns noise or nothing.
  if (query.length >= 10 && /^(who|what|which|when|where|why|how)\b/i.test(query)) {
    return true;
  }
  return false;
}

/**
 * Command-scope prefixes (#308) — list or filter Jump Actions only.
 *
 * Primary: `>` (VS Code / Cursor muscle memory — one keystroke).
 * Alias:   `action:` (explicit; same behavior).
 *
 * Bare prefix lists every available verb; text after it fuzzy-filters within.
 */
export function parseActionScopeQuery(query: string): {
  actionsOnly: boolean;
  /** Text fed to Fuse (empty → list all actions when scoped). */
  searchText: string;
  /** Which prefix matched, for UI copy / placeholder. */
  prefix: ">" | "action:" | null;
} {
  const trimmed = query.trim();
  if (trimmed.startsWith(">")) {
    return {
      actionsOnly: true,
      searchText: trimmed.slice(1).trimStart(),
      prefix: ">",
    };
  }
  const named = /^action:\s*(.*)$/i.exec(trimmed);
  if (named) {
    return {
      actionsOnly: true,
      searchText: named[1].trim(),
      prefix: "action:",
    };
  }
  return { actionsOnly: false, searchText: trimmed, prefix: null };
}

/** Prefix to insert when the player opts into Actions-only mode from the UI. */
export const ACTION_SCOPE_PREFIX = ">";

/** Matches `/api/ai/jump` question `.max(300)`. */
export const MAX_SEARCH_QUERY_CHARS = 300;

/**
 * How long to wait after the last keystroke before running Fuse.
 * Longer queries wait longer; Ask-shaped / skipped queries return 0 (no Fuse).
 */
export function fuseDebounceMs(query: string): number {
  const scope = parseActionScopeQuery(query);
  if (scope.actionsOnly && !scope.searchText) return 0;
  const trimmed = scope.searchText;
  if (!trimmed || shouldSkipFuzzySearch(trimmed)) return 0;
  if (trimmed.length <= 8) return 50;
  if (trimmed.length <= 16) return 120;
  return 180;
}

/**
 * Queries the fuzzy index can't answer well — the ones #184 wants to hand to
 * the LLM. Implementation lives in `@/lib/ai/ask-guard` so the API can share it.
 */
export { isQuestionLike } from "@/lib/ai/ask-guard";

/**
 * Titles worth surfacing first, by where the player currently is. Opening the
 * palette on the GM console and being offered "Toggle theme" is the kind of
 * thing that makes a palette feel generic (#184).
 */
function contextualTitles(pathname: string): string[] {
  if (/\/gm(\/|$)/.test(pathname)) {
    return ["GM Console", "Trainers", "Encounters", "Season Stats"];
  }
  if (/\/setup(\/|$)/.test(pathname)) {
    return ["Setup", "My Trainer", "Rules / FAQ", "Game Guide"];
  }
  if (/\/(me|trainers)(\/|$)/.test(pathname)) {
    return ["My Trainer", "Encounters", "Team Planner", "Pokémon Ownership"];
  }
  if (/\/tools(\/|$)/.test(pathname)) {
    return ["Team Planner", "Pokémon Ownership", "Game Guide", "Season Stats"];
  }
  if (/\/(rules|about)(\/|$)/.test(pathname)) {
    return ["Rules / FAQ", "FAQ", "Game Guide", "Trainers"];
  }
  if (/\/memorial(\/|$)/.test(pathname)) {
    return ["Season Stats", "Trainers", "Encounters"];
  }
  return ["My Trainer", "Season Stats", "Encounters", "Trainers"];
}

export function defaultSuggestions(
  results: SearchResult[],
  pathname = "",
): SearchResult[] {
  const picked: SearchResult[] = [];
  const push = (hit: SearchResult | undefined) => {
    if (!hit || picked.length >= 6) return;
    if (picked.some((p) => p.id === hit.id)) return;
    // Actions have their own empty-state group (#308).
    if (hit.category === "action") return;
    picked.push(hit);
  };

  // "My Trainer" stays first wherever it exists — it's the most-wanted jump.
  push(results.find((r) => r.id.startsWith("nav-me-")));

  for (const title of contextualTitles(pathname)) {
    push(results.find((r) => r.title === title));
  }

  // Then whatever the player has actually been choosing lately. Guarded so the
  // clock is never read during prerender (see `querySearchIndex`).
  const usage = getUsageStats();
  if (Object.keys(usage).length) {
    const now = Date.now();
    const byUsage = Object.entries(usage)
      .sort(([, a], [, b]) => usageBoost(b, now) - usageBoost(a, now))
      .map(([id]) => id);
    for (const id of byUsage) {
      push(results.find((r) => r.id === id));
    }
  }

  for (const r of results) {
    if (picked.length >= 6) break;
    if (r.category === "navigate") push(r);
  }

  return picked;
}

/**
 * Empty-state Actions block (#308) — curated verbs ahead of navigate suggestions.
 * Order: Ask → Import → Export → Theme → Copy link (whichever are indexed).
 */
export function listActionResults(results: SearchResult[]): SearchResult[] {
  const actions = results.filter((r) => r.category === "action");
  if (!actions.length) return [];

  const preferred = [
    "action-open-ask",
    "action-import-",
    "action-export-",
    "action-theme",
    "action-copy-link-",
  ];
  const picked: SearchResult[] = [];
  const push = (hit: SearchResult | undefined) => {
    if (!hit) return;
    if (picked.some((p) => p.id === hit.id)) return;
    picked.push(hit);
  };

  for (const key of preferred) {
    push(
      actions.find((r) =>
        key.endsWith("-") ? r.id.startsWith(key) : r.id === key,
      ),
    );
  }
  for (const r of actions) push(r);
  return picked;
}

export function defaultActionSuggestions(
  results: SearchResult[],
): SearchResult[] {
  return listActionResults(results).slice(0, 5);
}

type UsageEntry = { n: number; t: number };
type UsageStats = Record<string, UsageEntry>;

/** In-memory mirror of USAGE_KEY so Fuse ranking doesn't JSON.parse every keystroke. */
let usageCache: UsageStats | null = null;

function getUsageStats(): UsageStats {
  if (typeof window === "undefined") return {};
  if (usageCache) return usageCache;
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) {
      usageCache = {};
      return usageCache;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      usageCache = {};
      return usageCache;
    }
    const clean: UsageStats = {};
    for (const [id, entry] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (!entry || typeof entry !== "object") continue;
      const { n, t } = entry as { n?: unknown; t?: unknown };
      if (!Number.isFinite(n) || !Number.isFinite(t)) continue;
      clean[id] = { n: n as number, t: t as number };
    }
    usageCache = clean;
    return usageCache;
  } catch {
    usageCache = {};
    return usageCache;
  }
}

function persistUsageStats(stats: UsageStats) {
  usageCache = stats;
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(stats));
  } catch {
    // Quota / private mode — ranking just won't persist.
  }
}

/** Called when a result is actually chosen — powers ranking and suggestions. */
export function recordSearchUse(id: string) {
  if (typeof window === "undefined" || !id) return;
  try {
    const stats = { ...getUsageStats() };
    const prev = stats[id];
    stats[id] = { n: (prev?.n ?? 0) + 1, t: Date.now() };

    // Bound the store: drop the least useful entries once it grows.
    const keys = Object.keys(stats);
    if (keys.length > MAX_USAGE_ENTRIES) {
      const now = Date.now();
      const keep = keys
        .sort((a, b) => usageBoost(stats[b], now) - usageBoost(stats[a], now))
        .slice(0, MAX_USAGE_ENTRIES);
      const trimmed: UsageStats = {};
      for (const key of keep) trimmed[key] = stats[key];
      persistUsageStats(trimmed);
      return;
    }

    persistUsageStats(stats);
  } catch {
    // private mode / blocked storage
  }
}

function readRecentRaw(): string | null {
  const current = localStorage.getItem(RECENT_KEY);
  if (current) return current;
  const legacy = localStorage.getItem(LEGACY_RECENT_KEY);
  if (!legacy) return null;
  try {
    localStorage.setItem(RECENT_KEY, legacy);
    localStorage.removeItem(LEGACY_RECENT_KEY);
  } catch {
    // keep reading legacy if migrate write fails
  }
  return legacy;
}

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = readRecentRaw();
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENTS)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(title: string) {
  if (typeof window === "undefined" || !title.trim()) return;
  try {
    const next = [
      title.trim(),
      ...getRecentSearches().filter((q) => q !== title.trim()),
    ].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    localStorage.removeItem(LEGACY_RECENT_KEY);
  } catch {
    // private mode / blocked storage
  }
}

export function clearRecentSearches() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_KEY);
    localStorage.removeItem(LEGACY_RECENT_KEY);
    localStorage.removeItem(USAGE_KEY);
    usageCache = {};
  } catch {
    // ignore
  }
}

function truncate(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}
