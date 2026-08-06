import type { SearchSeasonContext } from "@/features/search/search-types";

/**
 * Compact plain-text snapshot of the season for Jump's Ask mode (#184).
 *
 * Two-phase client path (no LLM on pass 1):
 *   1. `detectAskPlan(question)` — shopping list of which slices matter
 *   2. `buildSeasonDigest(ctx, question)` — pack only those slices into ≤8k
 *
 * Built from context the browser already holds, so asking costs no extra DB
 * read. Identity minimization: handles only — real names / Discord never leave
 * the browser.
 */

const MAX_TRAINERS = 30;
const MAX_PARTY_PER_TRAINER = 10;
const MAX_FALLEN_PER_TRAINER = 8;
const MAX_RULES = 12;
const MAX_FAQS = 12;
const RULE_BODY_CHARS = 160;
const FAQ_ANSWER_CHARS = 160;
/** Hard ceiling (~2k tokens) so one huge season can't blow up a request. */
export const MAX_DIGEST_CHARS = 8_000;

const FALLEN_SLOT = "GRAVEYARD";

/** Which season slices to pack for a question. */
export type AskFocus =
  | "meta"
  | "league"
  | "standings"
  | "roster"
  | "full";

export type AskPlan = {
  focus: AskFocus;
  /** Handles mentioned in the question (matched against season trainers). */
  trainerHandles: string[];
  includeMons: boolean;
  includeFallenDetail: boolean;
  includeRules: boolean;
  /** Full rule bodies vs titles-only. */
  includeRuleBodies: boolean;
  includeFaqs: boolean;
  /**
   * Species + level only (no nickname / route / status). False when the
   * question asks about nicknames, routes, or shinies.
   */
  leanMons: boolean;
};

/** @deprecated Use AskFocus — kept for any external imports. */
export type DigestFocus = AskFocus;

/**
 * Pass 1: cheap client-side plan — no LLM. Decides which digest slices to
 * include so pass 2 never ships a 30-trainer party dump for a meta ask.
 */
export function detectAskPlan(
  question: string,
  ctx?: SearchSeasonContext | null,
): AskPlan {
  const q = question.toLowerCase().replace(/\s+/g, " ").trim();

  const selfHandle = resolveSelfHandle(ctx);
  const refersToSelf = /\b(my|mine|i'm|im|i am)\b/.test(q);
  // "me" alone is too noisy ("tell me the rules"); require team-ish context.
  const personalRoster =
    (refersToSelf || /\b(me|myself)\b/.test(q)) &&
    /\b(team|party|squad|box|roster|mons?|pok[eé]mon|fallen|living|badges?|board|run)\b/.test(
      q,
    );

  let trainerHandles = ctx ? matchTrainerHandles(q, ctx) : [];
  if (personalRoster && selfHandle) {
    const lower = selfHandle.toLowerCase();
    if (!trainerHandles.some((h) => h.toLowerCase() === lower)) {
      trainerHandles = [selfHandle, ...trainerHandles];
    }
  }

  const wantsDetail =
    /\b(nickname|nicknames|route|caught|shiny|shinies|status)\b/.test(q);
  const leanMons = !wantsDetail;

  const meta =
    /\b(strongest|weakest|best|worst|bst|base\s*stat|tier|ou\b|uber|meta|competitive|type\s*chart|effectiveness|evol(?:ve|ution)|learnset|movepool|pokedex|pok[eé]dex)\b/.test(
      q,
    ) ||
    /\b(what|which)\s+(are\s+)?(the\s+)?(strongest|best|weakest|worst)\b/.test(
      q,
    );

  const league =
    /\b(rom|hack|download|modern\s*emerald|emerald\s*modern|what\s+game|which\s+game|what\s+rom|rule|rules|faq|level\s*cap|gen(?:eration)?\s*\d|wipe|revive\s*token|save\s*scum|breeding|consumable|potion|shiny\s*toggle|end\s*goal|tournament|guide|how\s+do\s+i\s+play)\b/.test(
      q,
    );

  const standingsOnly =
    /\b(who('s| is)?\s+ahead|who('s| is)?\s+behind|standings|leaderboard|badge\s*count|most\s+badges|fewest\s+badges|how\s+many\s+badges)\b/.test(
      q,
    ) && !/\b(team|party|squad|fallen|living|dead|memorial|grave)\b/.test(q);

  const roster =
    trainerHandles.length > 0 ||
    personalRoster ||
    /\b(who|whose|ahead|behind|badge|badges|team|teams|party|fallen|living|dead|deaths?|memorial|grave|trainer|trainers|standings|leaderboard|box|squad|nickname|caught|route)\b/.test(
      q,
    );

  // "my team" / named handle → that trainer's roster only (never league-wide meta).
  if (trainerHandles.length > 0) {
    return {
      focus: "roster",
      trainerHandles,
      includeMons: true,
      includeFallenDetail: /\b(fallen|dead|death|deaths|memorial|grave|rip)\b/.test(
        q,
      ),
      includeRules: false,
      includeRuleBodies: false,
      includeFaqs: false,
      leanMons,
    };
  }

  // Personal ask but viewer has no board in this season — still roster-shaped
  // so we don't answer with empty meta / Game Guide deflection.
  if (personalRoster) {
    return {
      focus: "roster",
      trainerHandles: selfHandle ? [selfHandle] : [],
      includeMons: true,
      includeFallenDetail: true,
      includeRules: false,
      includeRuleBodies: false,
      includeFaqs: false,
      leanMons,
    };
  }

  // League-wide meta only — "strongest pokemon" with no "my team".
  if (meta && !league && !roster) {
    return {
      focus: "meta",
      trainerHandles: [],
      includeMons: false,
      includeFallenDetail: false,
      includeRules: false,
      includeRuleBodies: false,
      includeFaqs: false,
      leanMons: true,
    };
  }

  if (league && !roster) {
    return {
      focus: "league",
      trainerHandles: [],
      includeMons: false,
      includeFallenDetail: false,
      includeRules: true,
      includeRuleBodies: true,
      includeFaqs: true,
      leanMons: true,
    };
  }

  if (standingsOnly) {
    return {
      focus: "standings",
      trainerHandles: [],
      includeMons: false,
      includeFallenDetail: false,
      includeRules: false,
      includeRuleBodies: false,
      includeFaqs: false,
      leanMons: true,
    };
  }

  if (roster && !league) {
    return {
      focus: "roster",
      trainerHandles: [],
      includeMons: true,
      includeFallenDetail: true,
      includeRules: true,
      includeRuleBodies: false,
      includeFaqs: false,
      leanMons,
    };
  }

  // Mixed / unclear — pack everything, but lean mon labels and budget-stop.
  return {
    focus: "full",
    trainerHandles: [],
    includeMons: true,
    includeFallenDetail: true,
    includeRules: true,
    includeRuleBodies: true,
    includeFaqs: true,
    leanMons,
  };
}

function resolveSelfHandle(
  ctx?: SearchSeasonContext | null,
): string | null {
  if (!ctx?.myTrainerId) return null;
  const mine = ctx.trainers.find((t) => t.id === ctx.myTrainerId);
  const handle = mine?.handle?.trim();
  return handle || null;
}

/** Back-compat wrapper — prefer `detectAskPlan`. */
export function detectDigestFocus(question: string): AskFocus {
  return detectAskPlan(question).focus;
}

function matchTrainerHandles(
  q: string,
  ctx: SearchSeasonContext,
): string[] {
  // Normalize curly/smart apostrophes so CoolRice's / CoolRice's both match.
  const normalized = q.replace(/[\u2018\u2019\u02BC]/g, "'");
  const matched: string[] = [];
  const seen = new Set<string>();

  for (const t of ctx.trainers) {
    const handle = t.handle.trim();
    if (handle.length < 2) continue;

    const aliases = [
      handle,
      t.discordUsername?.trim(),
      t.discordDisplayName?.trim(),
    ].filter((a): a is string => Boolean(a && a.length >= 2));

    for (const alias of aliases) {
      const a = alias.toLowerCase();
      // Word-boundary-ish: avoid matching "al" inside "total".
      const re = new RegExp(
        `(^|[^a-z0-9_])${escapeRegExp(a)}([^a-z0-9_]|$)`,
        "i",
      );
      if (!re.test(normalized)) continue;
      const key = handle.toLowerCase();
      if (seen.has(key)) break;
      seen.add(key);
      matched.push(handle);
      break;
    }
  }
  return matched;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function short(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function monLabel(
  mon: {
    species: string;
    nickname: string | null;
    level: number | null;
    isShiny: boolean;
    catchRoute: string | null;
  },
  lean: boolean,
): string {
  if (lean) {
    const lv = mon.level != null ? `@L${mon.level}` : "";
    const shiny = mon.isShiny ? "*" : "";
    return `${mon.species}${shiny}${lv}`;
  }
  const name = mon.nickname?.trim()
    ? `${mon.nickname.trim()} (${mon.species})`
    : mon.species;
  const bits = [
    mon.level != null ? `L${mon.level}` : null,
    mon.isShiny ? "shiny" : null,
    mon.catchRoute?.trim() || null,
  ].filter(Boolean);
  return bits.length ? `${name} [${bits.join(", ")}]` : name;
}

/** Canonical GAME line — aligns Emerald Modern / Modern Emerald naming. */
function gameLine(game: string | null | undefined): string | null {
  const g = game?.trim();
  if (!g) return null;
  if (/modern/i.test(g) && /emerald/i.test(g)) {
    return "GAME: Pokémon Modern Emerald (Emerald ROM hack)";
  }
  return `GAME: ${g}`;
}

type Pack = {
  lines: string[];
  used: number;
  budget: number;
};

function createPack(budget: number): Pack {
  return { lines: [], used: 0, budget };
}

/** Try to append a block; skip entirely if it won't fit (no mid-line chops). */
function pushBlock(pack: Pack, block: string[]): boolean {
  if (!block.length) return true;
  const chunk = (pack.lines.length ? "\n" : "") + block.join("\n");
  if (pack.used + chunk.length > pack.budget) return false;
  pack.lines.push(...block);
  pack.used += chunk.length;
  return true;
}

function pushLine(pack: Pack, line: string): boolean {
  return pushBlock(pack, [line]);
}

function rulesBlock(
  ctx: SearchSeasonContext,
  bodies: boolean,
  bodyChars: number,
): string[] {
  if (!ctx.rules.length) return [];
  if (!bodies) {
    return [
      "",
      `RULE TITLES: ${ctx.rules
        .slice(0, MAX_RULES)
        .map((r) => r.title?.trim() || "Rule")
        .join("; ")}`,
    ];
  }
  const out = ["", "LEAGUE RULES:"];
  for (const r of ctx.rules.slice(0, MAX_RULES)) {
    const title = r.title?.trim() || "Rule";
    const body = r.body?.trim();
    out.push(body ? `- ${title}: ${short(body, bodyChars)}` : `- ${title}`);
  }
  return out;
}

function faqsBlock(ctx: SearchSeasonContext, answerChars: number): string[] {
  if (!ctx.faqs.length) return [];
  const out = ["", "FAQ:"];
  for (const f of ctx.faqs.slice(0, MAX_FAQS)) {
    out.push(
      `- Q: ${short(f.question, 100)} A: ${short(f.answer, answerChars)}`,
    );
  }
  return out;
}

function sortTrainersForPlan(
  ctx: SearchSeasonContext,
  plan: AskPlan,
): SearchSeasonContext["trainers"] {
  const preferred = new Set(
    plan.trainerHandles.map((h) => h.toLowerCase()),
  );
  const list = [...ctx.trainers];

  // Named / "my" in the question → only those trainers.
  if (preferred.size > 0) {
    const named = list.filter((t) => preferred.has(t.handle.toLowerCase()));
    if (named.length) return named;
  }

  // League-wide roster/full: keep the viewer first so budget cuts don't drop "my" team.
  list.sort((a, b) => {
    if (ctx.myTrainerId) {
      if (a.id === ctx.myTrainerId) return -1;
      if (b.id === ctx.myTrainerId) return 1;
    }
    const badgeDelta =
      (b.earnedBadgeKeys?.length ?? 0) - (a.earnedBadgeKeys?.length ?? 0);
    if (badgeDelta !== 0) return badgeDelta;
    return a.handle.localeCompare(b.handle);
  });
  return list.slice(0, MAX_TRAINERS);
}

function trainerHeaderLine(
  t: SearchSeasonContext["trainers"][number],
  includeStatus: boolean,
): string {
  const mons = t.pokemon ?? [];
  const fallen = mons.filter((m) => m.slot === FALLEN_SLOT);
  const living = mons.filter((m) => m.slot !== FALLEN_SLOT);
  const status =
    includeStatus && t.statusText?.trim()
      ? ` | "${short(t.statusText, 80)}"`
      : "";
  return `${t.handle} | ${t.earnedBadgeKeys?.length ?? 0} badges | ${living.length} living | ${fallen.length} fallen${status}`;
}

function trainerMonLines(
  t: SearchSeasonContext["trainers"][number],
  plan: AskPlan,
): string[] {
  if (!plan.includeMons) return [];
  const mons = t.pokemon ?? [];
  const fallen = mons.filter((m) => m.slot === FALLEN_SLOT);
  const living = mons.filter((m) => m.slot !== FALLEN_SLOT);
  const out: string[] = [];
  if (living.length) {
    out.push(
      `  team: ${living
        .slice(0, MAX_PARTY_PER_TRAINER)
        .map((m) => monLabel(m, plan.leanMons))
        .join("; ")}`,
    );
  }
  if (plan.includeFallenDetail && fallen.length) {
    out.push(
      `  fallen: ${fallen
        .slice(0, MAX_FALLEN_PER_TRAINER)
        .map((m) => monLabel(m, plan.leanMons))
        .join("; ")}`,
    );
  }
  return out;
}

const FULL_PLAN: AskPlan = {
  focus: "full",
  trainerHandles: [],
  includeMons: true,
  includeFallenDetail: true,
  includeRules: true,
  includeRuleBodies: true,
  includeFaqs: true,
  leanMons: true,
};

/**
 * Pass 2: pack plan-selected slices under MAX_DIGEST_CHARS.
 * Prefer `detectAskPlan` then this; `buildSeasonDigest` combines both.
 */
export function buildSeasonDigestFromPlan(
  ctx: SearchSeasonContext,
  plan: AskPlan,
): string | null {
  const hasLeagueBits =
    Boolean(ctx.game?.trim()) ||
    ctx.rules.length > 0 ||
    ctx.faqs.length > 0 ||
    ctx.badges.length > 0 ||
    ctx.trainers.length > 0;

  if (!hasLeagueBits) return null;

  // Meta asks (strongest / BST / tier) don't need boards — season + game only
  // so the model still knows the ROM; APP CONTEXT covers the rest.
  if (plan.focus === "meta") {
    const lines = [
      `SEASON: ${ctx.name} | year ${ctx.year} | status ${ctx.status}`,
      `ASK FOCUS: meta (no trainer rosters — answer from general Pokémon knowledge for this game)`,
    ];
    const game = gameLine(ctx.game);
    if (game) lines.push(game);
    return lines.join("\n");
  }

  const pack = createPack(MAX_DIGEST_CHARS);

  pushLine(
    pack,
    `SEASON: ${ctx.name} | year ${ctx.year} | status ${ctx.status} | focus ${plan.focus}`,
  );

  const selfHandle = resolveSelfHandle(ctx);
  if (selfHandle) {
    pushLine(
      pack,
      `YOU: ${selfHandle} (the signed-in trainer — "my/me/mine" in the question means this handle)`,
    );
  } else if (plan.focus === "roster" && plan.includeMons) {
    pushLine(
      pack,
      `YOU: (none — viewer has no trainer board in this season; cannot resolve "my team")`,
    );
  }

  const game = gameLine(ctx.game);
  if (game) pushLine(pack, game);

  if (ctx.badges.length) {
    const badgeList = ctx.badges
      .map((b) =>
        b.leaderName?.trim() ? `${b.label} (${b.leaderName.trim()})` : b.label,
      )
      .join(", ");
    pushLine(pack, `BADGES IN SEASON: ${badgeList}`);
  }

  const wantTrainers =
    plan.focus === "standings" ||
    plan.focus === "roster" ||
    plan.focus === "full";

  if (wantTrainers && ctx.trainers.length) {
    const header =
      plan.includeMons
        ? "TRAINERS — handle | badges | living | fallen"
        : "TRAINERS — handle | badges | living | fallen (counts only)";
    pushLine(pack, "");
    if (plan.includeMons) {
      pushLine(
        pack,
        "ROSTER FACTS: answer strongest/weakest from team: levels below (higher level = stronger unless asked about BST).",
      );
    }
    pushLine(pack, header);

    const trainers = sortTrainersForPlan(ctx, plan);
    let packed = 0;
    for (const t of trainers) {
      const block = [
        trainerHeaderLine(t, !plan.leanMons && plan.includeMons),
        ...trainerMonLines(t, plan),
      ];
      if (!pushBlock(pack, block)) {
        pushLine(
          pack,
          `(… ${trainers.length - packed} more trainers omitted for size)`,
        );
        break;
      }
      packed += 1;
    }

    if (
      packed === trainers.length &&
      ctx.trainers.length > MAX_TRAINERS
    ) {
      pushLine(
        pack,
        `(… ${ctx.trainers.length - MAX_TRAINERS} more trainers not listed)`,
      );
    }
  }

  if (plan.includeRules) {
    const block = rulesBlock(
      ctx,
      plan.includeRuleBodies,
      plan.focus === "league" ? 200 : RULE_BODY_CHARS,
    );
    if (!pushBlock(pack, block) && block.length) {
      pushLine(pack, "(… rules omitted for size)");
    }
  }

  if (plan.includeFaqs) {
    const block = faqsBlock(
      ctx,
      plan.focus === "league" ? 200 : FAQ_ANSWER_CHARS,
    );
    if (!pushBlock(pack, block) && block.length) {
      pushLine(pack, "(… FAQ omitted for size)");
    }
  }

  return pack.lines.join("\n");
}

/** Pass 1 + 2: detect plan from the question, then pack the digest. */
export function buildSeasonDigest(
  ctx: SearchSeasonContext,
  question?: string,
): string | null {
  const plan = question?.trim()
    ? detectAskPlan(question, ctx)
    : FULL_PLAN;
  return buildSeasonDigestFromPlan(ctx, plan);
}
