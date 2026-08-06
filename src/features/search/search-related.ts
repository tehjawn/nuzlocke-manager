import type { SearchResult } from "@/features/search/search-types";

/**
 * Jump-to chips under an Ask answer (#184 / #300).
 *
 * The model only returns prose — we never let it pick hrefs. Matching used to
 * be `answer.includes(title)`, which turned "Metagross" into chips for other
 * players' nicknames "Meta" and "Gross". Score instead: whole-word hits,
 * trainer anchors from the question/answer, species tags, longer titles first.
 *
 * Salvage also covers navigate / guide titles with aliases so overview-ish
 * Gemini answers can still surface Rules / Game Guide chips.
 */

const MAX_RELATED = 4;

/** Aliases → navigate/guide titles (salvage fallback only). */
const NAV_ALIASES: Array<{ title: string; aliases: string[] }> = [
  { title: "Rules / FAQ", aliases: ["rules", "rule", "faq"] },
  { title: "Game Guide", aliases: ["guide", "game guide", "walkthrough"] },
  { title: "My Trainer", aliases: ["my trainer", "my board", "my team"] },
  { title: "Trainers", aliases: ["trainers", "league board", "the board"] },
  { title: "Setup", aliases: ["setup", "get started", "getting started"] },
  { title: "Tools", aliases: ["tools"] },
  { title: "Season Stats", aliases: ["season stats", "stats", "memorial"] },
];

/** Whole-word / soft-boundary match (handles `Uwu's Metagross`). */
export function hasWordMatch(haystack: string, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (n.length < 3) return false;
  const h = haystack.toLowerCase();
  // Most titles miss — avoid compiling a RegExp per candidate.
  if (!h.includes(n)) return false;
  const re = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(n)}([^a-z0-9]|$)`,
    "i",
  );
  return re.test(haystack);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trainerHandleFromPokemon(r: SearchResult): string | null {
  // Subtitle is `… · handle` (last bit) for pokemon rows from search-index.
  if (r.category !== "pokemon") return null;
  const parts = r.subtitle.split("·").map((p) => p.trim());
  const last = parts[parts.length - 1];
  return last || null;
}

function speciesForResult(r: SearchResult): string | null {
  return r.pokemonSprite?.species?.trim() || null;
}

function scoreNavigateResult(
  r: SearchResult,
  answer: string,
  question: string,
): number {
  if (r.category !== "navigate" && r.category !== "guide") return 0;
  const corpus = `${question}\n${answer}`.toLowerCase();
  const title = r.title.trim();
  if (!title) return 0;

  let score = 0;
  if (hasWordMatch(corpus, title)) {
    score += 40 + Math.min(title.length, 24);
  }

  for (const entry of NAV_ALIASES) {
    if (entry.title.toLowerCase() !== title.toLowerCase()) continue;
    for (const alias of entry.aliases) {
      if (hasWordMatch(corpus, alias)) {
        score += 35 + Math.min(alias.length, 16);
        break;
      }
    }
  }

  return score;
}

function scoreRelatedResult(
  r: SearchResult,
  answer: string,
  question: string,
): number {
  const corpus = `${question}\n${answer}`.toLowerCase();
  const title = r.title.trim();
  if (title.length < 3) return 0;

  let score = 0;

  if (r.category === "trainer") {
    if (!hasWordMatch(corpus, title)) return 0;
    // Handle in the question (named ask) ranks above a casual mention in prose.
    if (hasWordMatch(question, title)) score += 80;
    if (hasWordMatch(answer, title)) score += 50;
    score += Math.min(title.length, 24);
    return score;
  }

  const navScore = scoreNavigateResult(r, answer, question);
  if (navScore > 0) return navScore;

  if (r.category !== "pokemon") return 0;

  const handle = trainerHandleFromPokemon(r);
  const handleInCorpus = handle ? hasWordMatch(corpus, handle) : false;
  const handleInQuestion = handle ? hasWordMatch(question, handle) : false;

  const titleInAnswer = hasWordMatch(answer, title);
  const species = speciesForResult(r);
  const speciesInAnswer = Boolean(
    species &&
      species.toLowerCase() !== title.toLowerCase() &&
      hasWordMatch(answer, species),
  );

  // Nickname-only substring ghosts ("Meta" inside "Metagross") — no word hit.
  if (!titleInAnswer && !speciesInAnswer) return 0;

  if (titleInAnswer) {
    score += 40 + Math.min(title.length, 28);
  }
  if (speciesInAnswer && species) {
    // Answer used the species name while the chip title is a nickname.
    score += 55 + Math.min(species.length, 28);
  }
  if (handleInQuestion) score += 70;
  else if (handleInCorpus) score += 45;

  return score;
}

/**
 * Pick Jump-to chips for an Ask answer. Empty when nothing anchors cleanly.
 */
export function pickRelatedSearchResults(
  results: SearchResult[],
  answer: string,
  question: string,
  limit = MAX_RELATED,
): SearchResult[] {
  const ranked: Array<{ item: SearchResult; score: number }> = [];

  for (const r of results) {
    if (
      r.category !== "trainer" &&
      r.category !== "pokemon" &&
      r.category !== "navigate" &&
      r.category !== "guide"
    ) {
      continue;
    }
    const score = scoreRelatedResult(r, answer, question);
    if (score <= 0) continue;
    ranked.push({ item: r, score });
  }

  const categoryRank = (c: SearchResult["category"]) =>
    c === "trainer" ? 0 : c === "pokemon" ? 1 : 2;

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Stable-ish: trainers before pokemon before pages when tied.
    if (a.item.category !== b.item.category) {
      return categoryRank(a.item.category) - categoryRank(b.item.category);
    }
    return b.item.title.length - a.item.title.length;
  });

  const picked: SearchResult[] = [];
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();

  for (const { item } of ranked) {
    if (picked.length >= limit) break;
    if (seenIds.has(item.id)) continue;
    const titleKey = item.title.trim().toLowerCase();
    // One chip per display title — prefer the higher-scored (already sorted).
    if (seenTitles.has(titleKey)) continue;
    seenIds.add(item.id);
    seenTitles.add(titleKey);
    picked.push(item);
  }

  return picked;
}
