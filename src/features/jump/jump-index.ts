import Fuse, { type IFuseOptions } from "fuse.js";
import { EMERALD_GUIDE } from "@/features/guide/emerald-guide";
import { guideChapterLabel } from "@/features/guide/guide-gym-prep";
import type {
  JumpFuseHit,
  JumpResult,
  JumpSeasonContext,
} from "@/features/jump/jump-types";
import { avatarImageUrl } from "@/lib/sprites";
import { toolsHref } from "@/lib/tools-routes";

const FUSE_OPTIONS: IFuseOptions<JumpResult> = {
  keys: [
    { name: "title", weight: 0.5 },
    { name: "subtitle", weight: 0.25 },
    { name: "tags", weight: 0.25 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
  includeMatches: true,
  minMatchCharLength: 1,
};

const RECENT_KEY = "nuzlocke-jump-recents";
const MAX_RECENTS = 6;
const MAX_RESULTS = 24;

const SLOT_LABEL: Record<string, string> = {
  MAIN: "Party",
  RESERVE: "Reserve",
  GRAVEYARD: "Memorial",
  ENCOUNTERED: "Encountered",
};

export function buildGlobalResults(): JumpResult[] {
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
      id: "action-theme",
      title: "Toggle theme",
      subtitle: "Switch light / dark",
      category: "action",
      tags: ["theme", "dark", "light", "mode", "appearance"],
      action: "toggle-theme",
    },
  ];
}

function seasonSectionTabs(slug: string, status: string) {
  const base = `/challenges/${slug}`;
  const tournamentLabel = status === "TOURNAMENT" ? "Ladder" : "Tournament";
  return [
    { href: `${base}/about`, label: "About" },
    { href: `${base}/rules`, label: "Rules / FAQ" },
    { href: base, label: "Trainers" },
    { href: `${base}/encounters`, label: "Encounters" },
    { href: `${base}/tools`, label: "Tools" },
    { href: `${base}/memorial`, label: "Memorial" },
    { href: `${base}/tournament`, label: tournamentLabel },
  ];
}

export function buildSeasonResults(ctx: JumpSeasonContext): JumpResult[] {
  const base = `/challenges/${ctx.slug}`;

  // First-run funnel: only Setup + My Trainer (+ GM if somehow firstRun+GM —
  // GMs are excluded from firstRun by the layout predicate).
  if (ctx.firstRun) {
    const navigate: JumpResult[] = [
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
        subtitle: "Jump to your board",
        href: `${base}/me`,
        category: "navigate",
        tags: ["me", "my board", "my trainer", "self"],
      });
    }
    return navigate;
  }

  const tabs = seasonSectionTabs(ctx.slug, ctx.status);

  const navigate: JumpResult[] = [
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
      tags: [tab.label.toLowerCase(), "section", "tab"],
    })),
    {
      id: `nav-activity-${ctx.slug}`,
      title: "Pack feed",
      subtitle: `${ctx.name} · All activity`,
      href: `${base}/activity`,
      category: "navigate",
      tags: ["feed", "activity", "pack", "updates"],
    },
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
      subtitle: "Jump to your board",
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

  const trainers: JumpResult[] = ctx.trainers.map((t) => {
    const badges = t.earnedBadgeKeys ?? [];
    const mons = t.pokemon ?? [];
    const badgeCount = badges.length;
    const monCount = mons.length;
    const subtitleParts = [
      t.realName?.trim() || t.discordDisplayName?.trim() || null,
      badgeCount ? `${badgeCount} badge${badgeCount === 1 ? "" : "s"}` : null,
      monCount ? `${monCount} Pokémon` : null,
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
      ].filter(Boolean),
      imageUrl: avatarImageUrl(t.avatarSpriteKey),
    };
  });

  const pokemon: JumpResult[] = ctx.trainers.flatMap((t) =>
    (t.pokemon ?? []).map((mon) => {
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
    }),
  );

  const badges: JumpResult[] = ctx.badges.map((b) => ({
    id: `badge-${b.key}`,
    title: b.label,
    subtitle: [b.leaderName?.trim(), b.category].filter(Boolean).join(" · "),
    href: base,
    category: "badge" as const,
    tags: [b.label, b.key, b.leaderName ?? "", b.category, "badge", "gym"],
  }));

  const rules: JumpResult[] = [
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

  const guide: JumpResult[] = [
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
    ...trainers,
    ...pokemon,
    ...badges,
    ...rules,
    ...guide,
    {
      id: `bounty-${ctx.slug}`,
      title: "Bounty Hunter",
      subtitle: `${ctx.name} · Open bounties & exclusives`,
      href: toolsHref(ctx.slug, "bounty"),
      category: "navigate" as const,
      tags: [
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

export function createJumpIndex(results: JumpResult[]) {
  return new Fuse(results, FUSE_OPTIONS);
}

export function searchJumpIndex(
  index: Fuse<JumpResult>,
  query: string,
): JumpFuseHit[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return index.search(trimmed).slice(0, MAX_RESULTS).map((hit) => ({
    item: hit.item,
    matches: hit.matches,
  }));
}

export function defaultSuggestions(results: JumpResult[]): JumpResult[] {
  const preferredIds = [
    results.find((r) => r.id.startsWith("nav-me-"))?.id,
    results.find((r) => r.title === "Memorial")?.id,
    results.find((r) => r.title === "Encounters")?.id,
    results.find((r) => r.title === "Trainers" || r.subtitle.includes("League board"))
      ?.id,
    results.find((r) => r.category === "trainer")?.id,
    results.find((r) => r.id === "action-theme")?.id,
  ].filter(Boolean) as string[];

  const picked: JumpResult[] = [];
  for (const id of preferredIds) {
    const hit = results.find((r) => r.id === id);
    if (hit && !picked.some((p) => p.id === hit.id)) picked.push(hit);
    if (picked.length >= 6) break;
  }

  for (const r of results) {
    if (picked.length >= 6) break;
    if (r.category === "navigate" && !picked.some((p) => p.id === r.id)) {
      picked.push(r);
    }
  }

  return picked;
}

export function getRecentJumps(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENTS)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentJump(title: string) {
  if (typeof window === "undefined" || !title.trim()) return;
  try {
    const next = [
      title.trim(),
      ...getRecentJumps().filter((q) => q !== title.trim()),
    ].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // private mode / blocked storage
  }
}

export function clearRecentJumps() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // ignore
  }
}

function truncate(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}
