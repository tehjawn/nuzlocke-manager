import type { SearchSeasonContext } from "@/features/search/search-types";

/**
 * Compact plain-text snapshot of the season for Jump's Ask mode (#184).
 *
 * Built from context the browser already holds, so asking a question costs no
 * extra DB read. Deliberately terse — this is prompt input, not display copy,
 * and every line is tokens we pay for.
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
/** Hard ceiling (~2k tokens) so one huge season can't blow up a request. */
const MAX_DIGEST_CHARS = 8_000;

const FALLEN_SLOT = "GRAVEYARD";

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

/**
 * Returns null when there is nothing worth asking about (global pages register
 * an identity-only season until a challenge page overlays the real index).
 */
export function buildSeasonDigest(ctx: SearchSeasonContext): string | null {
  if (!ctx.trainers.length) return null;

  const lines: string[] = [
    `SEASON: ${ctx.name} | year ${ctx.year} | status ${ctx.status}`,
  ];

  if (ctx.badges.length) {
    const badgeList = ctx.badges
      .map((b) => (b.leaderName?.trim() ? `${b.label} (${b.leaderName.trim()})` : b.label))
      .join(", ");
    lines.push(`BADGES IN SEASON: ${badgeList}`);
  }

  lines.push(
    "",
    "TRAINERS — handle | badges earned | living mons | fallen mons | status",
  );

  const trainers = ctx.trainers.slice(0, MAX_TRAINERS);
  for (const t of trainers) {
    const mons = t.pokemon ?? [];
    const fallen = mons.filter((m) => m.slot === FALLEN_SLOT);
    const living = mons.filter((m) => m.slot !== FALLEN_SLOT);
    const status = t.statusText?.trim() ? ` | "${short(t.statusText, 80)}"` : "";

    lines.push(
      `${t.handle} | ${t.earnedBadgeKeys?.length ?? 0} badges | ${living.length} living | ${fallen.length} fallen${status}`,
    );

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

  if (ctx.rules.length) {
    lines.push("", "LEAGUE RULES:");
    for (const r of ctx.rules.slice(0, MAX_RULES)) {
      const title = r.title?.trim() || "Rule";
      lines.push(`- ${title}: ${short(r.body, RULE_BODY_CHARS)}`);
    }
  }

  if (ctx.faqs.length) {
    lines.push("", "FAQ:");
    for (const f of ctx.faqs.slice(0, MAX_FAQS)) {
      lines.push(`- Q: ${short(f.question, 100)} A: ${short(f.answer, RULE_BODY_CHARS)}`);
    }
  }

  const digest = lines.join("\n");
  if (digest.length <= MAX_DIGEST_CHARS) return digest;
  return `${digest.slice(0, MAX_DIGEST_CHARS)}\n(… snapshot truncated)`;
}
