import type { SearchSeasonContext } from "@/features/search/search-types";

/**
 * Detect whether a question should request a pokemon_ranking card (#300).
 * Pure BST / tier meta stays prose; living-board level rankings get structure.
 */

export function wantsPokemonRanking(
  question: string,
  season?: SearchSeasonContext | null,
): boolean {
  if (!season?.trainers.some((t) => (t.pokemon?.length ?? 0) > 0)) {
    return false;
  }

  const q = question.toLowerCase().replace(/\s+/g, " ").trim();

  // Competitive / species meta — leave to prose + APP CONTEXT.
  if (
    /\b(bst|base\s*stats?|tier|ou\b|uber|competitive|type\s*chart|movepool|learnset)\b/.test(
      q,
    )
  ) {
    return false;
  }

  // Keep "best/top" tied to party wording so "best rules" stays prose.
  return (
    /\b(strongest|weakest|highest\s*level|lowest\s*level)\b/.test(q) ||
    /\b(best|top)\s+(party|team|mons?|pok[eé]mon)\b/.test(q) ||
    /\b(what|which)\s+(are\s+)?(the\s+)?(strongest|weakest|highest|lowest)\b/.test(
      q,
    ) ||
    /\bwho('s| is)?\s*(the\s+)?(strongest|weakest|highest|lowest)\b/.test(q)
  );
}
