/**
 * Cheap Ask-quality gates for Jump (#184).
 *
 * Shared by the palette (hide / no-op Ask) and `/api/ai/jump` (reject before
 * Gemini + rate limit). Heuristics only — no LLM.
 */

const QUESTION_STARTERS =
  /^(who|what|which|when|where|why|how|is|are|does|do|did|can|should|has|have)\b/i;

const COMPARATIVE =
  /\b(most|least|best|worst|strongest|weakest|ahead|behind|top|highest|lowest|compare|ranked|leading|fewest)\b/i;

const ROSTER_WORDS =
  /\b(team|teams|party|squad|box|roster|mons?|pok[eé]mon|fallen|living|badges?|board|standings|leaderboard|rules?|faq|rom|hack)\b/i;

/**
 * Queries the fuzzy index can't answer well — the ones #184 wants to hand to
 * the LLM. Deliberately conservative: a false positive costs a wasted row.
 */
export function isQuestionLike(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length < 6) return false;
  if (trimmed.includes("?")) return true;
  return QUESTION_STARTERS.test(trimmed) || COMPARATIVE.test(trimmed);
}

/**
 * Keyboard mash / nonsense that should never burn Gemini quota.
 * Tuned to catch `fawefjojfoajweof` without rejecting short real asks.
 */
export function isGibberish(query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 3) return true;

  const letters = trimmed.replace(/[^a-z]/g, "");
  if (letters.length < 3) return true;

  const unique = new Set(letters).size;
  if (letters.length >= 8 && unique / letters.length < 0.35) return true;

  const vowels = (letters.match(/[aeiou]/g) ?? []).length;
  const vowelRatio = vowels / letters.length;
  if (letters.length >= 8 && vowelRatio < 0.15) return true;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    const core = tokens[0].replace(/[^a-z0-9']/g, "");
    // Ask is for phrases; a lone long token is mash or a fuzzy search term.
    if (core.length >= 10 && !trimmed.includes("?")) return true;
    if (core.length >= 12 && vowelRatio < 0.28) return true;
  }

  // Long consonant cluster + weak vowels (classic smash).
  if (
    letters.length >= 10 &&
    vowelRatio < 0.22 &&
    /[bcdfghjklmnpqrstvwxyz]{5,}/.test(letters)
  ) {
    return true;
  }

  return false;
}

function hasSoftWord(haystack: string, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (n.length < 2) return false;
  const re = new RegExp(
    `(^|[^a-z0-9_])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9_]|$)`,
    "i",
  );
  return re.test(haystack);
}

export type AskGuardFailureCode = "GIBBERISH" | "NOT_QUESTION";

export type AskGuardResult =
  | { ok: true }
  | { ok: false; code: AskGuardFailureCode; error: string };

const GIBBERISH_ERROR =
  "That doesn’t look like a question — try asking about the season.";
const NOT_QUESTION_ERROR =
  "Ask a question about the league — e.g. who’s ahead, or who’s on a trainer’s team.";

/**
 * Whether a string is worth sending to Jump Ask.
 *
 * `entityHints` (handles / species / nicknames from the in-memory season)
 * lets short anchored asks through even without who/what.
 *
 * `allowMultiWord` — server-side escape hatch after the client already gated
 * with season hints, so "CoolRice strongest pokemon" isn't 400'd without
 * shipping the whole hint list up.
 */
export function evaluateAskQuery(
  question: string,
  opts?: { entityHints?: readonly string[]; allowMultiWord?: boolean },
): AskGuardResult {
  const trimmed = question.trim();
  if (trimmed.length < 3) {
    return { ok: false, code: "NOT_QUESTION", error: NOT_QUESTION_ERROR };
  }
  if (isGibberish(trimmed)) {
    return { ok: false, code: "GIBBERISH", error: GIBBERISH_ERROR };
  }
  if (isQuestionLike(trimmed)) {
    return { ok: true };
  }

  const hints = opts?.entityHints ?? [];
  const hit = hints.some((h) => hasSoftWord(trimmed, h));
  if (hit && (ROSTER_WORDS.test(trimmed) || COMPARATIVE.test(trimmed))) {
    return { ok: true };
  }
  // Named entity alone with a `?` already passed isQuestionLike; bare handle
  // with no league framing stays closed so we don't Ask on accidental typing.
  if (hit && trimmed.includes("?")) {
    return { ok: true };
  }

  if (
    opts?.allowMultiWord &&
    trimmed.length >= 8 &&
    trimmed.split(/\s+/).filter(Boolean).length >= 2
  ) {
    return { ok: true };
  }

  return { ok: false, code: "NOT_QUESTION", error: NOT_QUESTION_ERROR };
}
