import type { SearchSeasonContext } from "@/features/search/search-types";

/**
 * Compact plain-text snapshot of the season for Jump's Ask mode (#184).
 *
 * Built from context the browser already holds, so asking a question costs no
 * extra DB read. Deliberately terse — this is prompt input, not display copy,
 * and every line is tokens we pay for.
 *
 * Intent-scoped: the question steers which slices we include so a ROM/rules
 * ask doesn't ship every trainer's party, and a standings ask skips FAQ bodies.
 *
 * Identity minimization: handles only. Real names, Discord usernames, and
 * display names are all in `SearchSeasonContext` and all omitted — they never
 * change the answer to "who's ahead in badges", so they don't leave the browser.
 */

const MAX_TRAINERS = 30;
const MAX_PARTY_PER_TRAINER = 10;
const MAX_FALLEN_PER_TRAINER = 8;
const MAX_RULES = 12;
const MAX_FAQS = 12;
const RULE_BODY_CHARS = 160;
const FAQ_ANSWER_CHARS = 160;
/** Hard ceiling (~2k tokens) so one huge season can't blow up a request. */
const MAX_DIGEST_CHARS = 8_000;

const FALLEN_SLOT = "GRAVEYARD";

export type DigestFocus = "league" | "roster" | "full";

/**
 * Cheap client-side topic guess — no LLM. Biases the digest toward the slices
 * that can answer the question so we spend fewer input tokens.
 */
export function detectDigestFocus(question: string): DigestFocus {
  const q = question.toLowerCase();

  const league =
    /\b(rom|hack|download|modern\s*emerald|emerald\s*modern|what\s+game|which\s+game|what\s+rom|rule|rules|faq|level\s*cap|gen(?:eration)?\s*\d|wipe|revive\s*token|save\s*scum|breeding|consumable|potion|shiny\s*toggle|end\s*goal|tournament|guide|how\s+do\s+i\s+play)\b/.test(
      q,
    );
  const roster =
    /\b(who|whose|ahead|behind|badge|badges|team|teams|party|fallen|living|dead|deaths?|memorial|grave|trainer|trainers|standings|leaderboard|box|squad|nickname|caught|route)\b/.test(
      q,
    );

  if (league && !roster) return "league";
  if (roster && !league) return "roster";
  return "full";
}

function short(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function monLabel(mon: {
  species: string;
  nickname: string | null;
  level: number | null;
  isShiny: boolean;
  catchRoute: string | null;
}): string {
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

function appendRules(lines: string[], ctx: SearchSeasonContext, bodyChars: number) {
  if (!ctx.rules.length) return;
  lines.push("", "LEAGUE RULES:");
  for (const r of ctx.rules.slice(0, MAX_RULES)) {
    const title = r.title?.trim() || "Rule";
    const body = r.body?.trim();
    lines.push(body ? `- ${title}: ${short(body, bodyChars)}` : `- ${title}`);
  }
}

function appendFaqs(lines: string[], ctx: SearchSeasonContext, answerChars: number) {
  if (!ctx.faqs.length) return;
  lines.push("", "FAQ:");
  for (const f of ctx.faqs.slice(0, MAX_FAQS)) {
    lines.push(
      `- Q: ${short(f.question, 100)} A: ${short(f.answer, answerChars)}`,
    );
  }
}

function appendTrainers(
  lines: string[],
  ctx: SearchSeasonContext,
  opts: { includeMons: boolean },
) {
  if (!ctx.trainers.length) return;

  lines.push(
    "",
    opts.includeMons
      ? "TRAINERS — handle | badges earned | living mons | fallen mons | status"
      : "TRAINERS — handle | badges earned | living | fallen",
  );

  const trainers = ctx.trainers.slice(0, MAX_TRAINERS);
  for (const t of trainers) {
    const mons = t.pokemon ?? [];
    const fallen = mons.filter((m) => m.slot === FALLEN_SLOT);
    const living = mons.filter((m) => m.slot !== FALLEN_SLOT);
    const status =
      opts.includeMons && t.statusText?.trim()
        ? ` | "${short(t.statusText, 80)}"`
        : "";

    lines.push(
      `${t.handle} | ${t.earnedBadgeKeys?.length ?? 0} badges | ${living.length} living | ${fallen.length} fallen${status}`,
    );

    if (!opts.includeMons) continue;

    if (living.length) {
      lines.push(
        `  team: ${living.slice(0, MAX_PARTY_PER_TRAINER).map(monLabel).join("; ")}`,
      );
    }
    if (fallen.length) {
      lines.push(
        `  fallen: ${fallen.slice(0, MAX_FALLEN_PER_TRAINER).map(monLabel).join("; ")}`,
      );
    }
  }

  if (ctx.trainers.length > MAX_TRAINERS) {
    lines.push(
      `(… ${ctx.trainers.length - MAX_TRAINERS} more trainers not listed)`,
    );
  }
}

/**
 * Returns null when there is nothing worth asking about (no game, rules, FAQ,
 * badges, or trainers — e.g. an empty identity stub).
 */
export function buildSeasonDigest(
  ctx: SearchSeasonContext,
  question?: string,
): string | null {
  const hasLeagueBits =
    Boolean(ctx.game?.trim()) ||
    ctx.rules.length > 0 ||
    ctx.faqs.length > 0 ||
    ctx.badges.length > 0 ||
    ctx.trainers.length > 0;

  if (!hasLeagueBits) return null;

  const focus = question?.trim()
    ? detectDigestFocus(question)
    : ("full" as DigestFocus);

  const lines: string[] = [
    `SEASON: ${ctx.name} | year ${ctx.year} | status ${ctx.status}`,
  ];

  const game = gameLine(ctx.game);
  if (game) lines.push(game);

  if (ctx.badges.length) {
    const badgeList = ctx.badges
      .map((b) =>
        b.leaderName?.trim() ? `${b.label} (${b.leaderName.trim()})` : b.label,
      )
      .join(", ");
    lines.push(`BADGES IN SEASON: ${badgeList}`);
  }

  if (focus === "league") {
    // Rules + FAQ only — skip party lists (largest token cost).
    appendRules(lines, ctx, 200);
    appendFaqs(lines, ctx, 200);
  } else if (focus === "roster") {
    // Standings / teams — skip FAQ/rule bodies; titles alone are enough if mixed.
    appendTrainers(lines, ctx, { includeMons: true });
    if (ctx.rules.length) {
      lines.push(
        "",
        `RULE TITLES: ${ctx.rules
          .slice(0, MAX_RULES)
          .map((r) => r.title?.trim() || "Rule")
          .join("; ")}`,
      );
    }
  } else {
    appendTrainers(lines, ctx, { includeMons: true });
    appendRules(lines, ctx, RULE_BODY_CHARS);
    appendFaqs(lines, ctx, FAQ_ANSWER_CHARS);
  }

  const digest = lines.join("\n");
  if (digest.length <= MAX_DIGEST_CHARS) return digest;
  return `${digest.slice(0, MAX_DIGEST_CHARS)}\n(… snapshot truncated)`;
}
