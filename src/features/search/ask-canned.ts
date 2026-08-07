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
  id:
    | "app_overview"
    | "how_to_play"
    | "self_trader"
    | "hyper_training";
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
  {
    id: "self_trader",
    phrases: new Set([
      "self trade",
      "self trader",
      "where do i self trade",
      "where is the self trader",
      "how do i self trade",
      "how do i trade evolve",
      "how do i evolve by trade",
      "trade evolution",
      "trade evolutions",
      "where do i trade evolve",
    ]),
    prose: () =>
      [
        "Modern Emerald’s solo trade path is the Devon Corp. **Self-Trader** on **Lilycove Department Store 1F** (NPC + PC).",
        "Pick a party mon → in-game trade scene → triggers **trade** and **held-item trade** evolutions. **10,000¥** per use, or a one-time **1,000,000¥** lifetime license.",
        "Season Rules may still ban self-trades — check hosts. Open the **Game Guide** Lilycove chapter for the full callout.",
      ].join("\n\n"),
    surfaces: ["game_guide", "rules"],
  },
  {
    id: "hyper_training",
    phrases: new Set([
      "ev train",
      "ev training",
      "where do i ev train",
      "where to ev train",
      "hyper training",
      "hyper training gym",
      "where is hyper training",
      "where is the hyper training gym",
      "ability swapper",
      "ability tutor",
      "where is the ability tutor",
      "iv maximizer",
      "ev reset",
    ]),
    prose: () =>
      [
        "Warp into the **Hyper Training Gym** from **Lilycove City** (northeast of town near the Dept Store). Battle Frontier has a twin door later.",
        "**Anytime you can reach Lilycove:** EV Training (six stat trainers; Macho Brace ×5) and **EV Reset**.",
        "**Post-champion only:** IV Maximizer (Lv.100), EXP Nurse, and Ability Swapper. Details are in the **Game Guide** Lilycove chapter.",
      ].join("\n\n"),
    surfaces: ["game_guide"],
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

export type AskStarterPrompt = {
  /** Short chip label shown in the empty drawer. */
  label: string;
  /** Full question submitted when the chip is clicked. */
  question: string;
};

/**
 * Empty-state prompts for the Ask drawer. Mix of canned orientation (no
 * Gemini) and common season questions so the rail never feels blank.
 */
export function askStarterPrompts(
  season: SearchSeasonContext | null,
): AskStarterPrompt[] {
  const starters: AskStarterPrompt[] = [
    { label: "What can you do?", question: "What can you do?" },
    { label: "How do I get started?", question: "How do I play?" },
  ];

  if (!season) {
    starters.push({ label: "What is this app?", question: "What is this app?" });
    return starters;
  }

  starters.push(
    {
      label: "Strongest Pokémon?",
      question: "What are the strongest Pokémon?",
    },
    {
      label: "Who’s ahead in badges?",
      question: "Who’s ahead in badges?",
    },
  );

  if (season.myTrainerId) {
    starters.push({
      label: "Strongest on my team?",
      question: "What are the strongest on my team?",
    });
  }

  return starters;
}

