import type { AskAnswer, AskSurfaceId } from "@/features/search/ask-types";
import type { SearchSeasonContext } from "@/features/search/search-types";

/**
 * Hard-coded product-orientation replies for Ask (#300).
 *
 * Matched client-side before `POST /api/ai/jump` so "What can you do?" is
 * instant, free, and still works when Gemini is 501 / rate-limited. Patterns
 * stay high-precision so league questions that merely share words fall through.
 */

type CannedContext = {
  seasonName?: string;
  game?: string | null;
};

type AskCannedIntent = {
  id: "app_overview" | "how_to_play";
  phrases: ReadonlySet<string>;
  prose: (ctx: CannedContext) => string;
  surfaces: AskSurfaceId[];
};

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeAskQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * League / entity anchors that mean this is a real season question, not
 * product orientation — even if it starts with "what can you tell me".
 */
function hasLeagueStealAnchors(normalized: string): boolean {
  // "what can you tell me about …" / "regarding …" — always fall through.
  if (/\b(about|regarding|concerning)\b/.test(normalized)) return true;

  if (
    /\b(badge|badges|fallen|memorial|grave|level|levels|team|party|squad|roster|standings|leaderboard|trainer|trainers|death|deaths|dead|wipe|wipes|rule|rules|faq|rom|hack|shiny|nicknames?|caught|route)\b/.test(
      normalized,
    )
  ) {
    return true;
  }

  // "what can you tell me who…" / "can you which…" — interrogative follow-ons.
  if (
    /\b(tell me|can you)\b/.test(normalized) &&
    /\b(who|whose|which|my|mine)\b/.test(normalized)
  ) {
    return true;
  }

  return false;
}

const INTENTS: AskCannedIntent[] = [
  {
    id: "app_overview",
    phrases: new Set([
      "what can you do",
      "what can you tell me",
      "what do you do",
      "what do you know",
      "what is this",
      "what is this app",
      "what is this site",
      "whats this",
      "whats this app",
      "who are you",
      "help",
      "help me",
      "how does this work",
      "how does ask work",
      "what can ask do",
    ]),
    prose: ({ seasonName, game }) => {
      const seasonBit = seasonName
        ? ` You’re looking at **${seasonName}**${game ? ` (${game})` : ""}.`
        : "";
      return [
        `I’m Ask — a quick season assistant inside Jump.${seasonBit}`,
        "I can answer questions about trainers, living parties, badges, fallen Pokémon, rules, and the Game Guide using this season’s board.",
        "Pick a link below to jump into the app, or ask something specific like “who’s ahead?” or “strongest on my team?”",
      ].join("\n\n");
    },
    surfaces: ["trainers", "rules", "my_trainer", "game_guide"],
  },
  {
    id: "how_to_play",
    phrases: new Set([
      "how do i play",
      "how do i start",
      "where do i start",
      "getting started",
      "get started",
      "how to play",
      "how to start",
    ]),
    prose: ({ seasonName }) => {
      const seasonBit = seasonName ? ` for **${seasonName}**` : "";
      return [
        `Here’s a short path to get rolling${seasonBit}.`,
        "Start on **Setup** if you still need a board, claim **My Trainer**, skim **Rules / FAQ**, then use the **Game Guide** for ROM progression. Ask me anytime about teams, badges, or fallen Pokémon.",
      ].join("\n\n");
    },
    surfaces: ["setup", "game_guide", "rules", "my_trainer"],
  },
];

function findCannedIntent(normalized: string): AskCannedIntent | null {
  if (!normalized || hasLeagueStealAnchors(normalized)) return null;
  return INTENTS.find((entry) => entry.phrases.has(normalized)) ?? null;
}

export function matchCannedAskIntent(
  question: string,
  season?: SearchSeasonContext | null,
): AskAnswer | null {
  const intent = findCannedIntent(normalizeAskQuestion(question));
  if (!intent) return null;

  return {
    kind: "canned",
    intentId: intent.id,
    markdown: intent.prose({
      seasonName: season?.name,
      game: season?.game,
    }),
    surfaces: intent.surfaces,
  };
}

/** True when the live query is a canned orientation ask (for Ask-row gating). */
export function isCannedAskQuestion(question: string): boolean {
  return findCannedIntent(normalizeAskQuestion(question)) != null;
}
