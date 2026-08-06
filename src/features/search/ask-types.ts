/**
 * Shared Ask answer shapes (#300).
 *
 * The model (or a canned intent) returns data; React chooses presentation.
 * Never trust model-supplied hrefs or image URLs — resolve against the season
 * index / digest on the client.
 */

export type AskSurfaceId =
  | "trainers"
  | "rules"
  | "faq"
  | "my_trainer"
  | "game_guide"
  | "setup"
  | "tools";

export type AskPokemonRankingItem = {
  species: string;
  nickname?: string;
  level?: number;
  trainerHandle: string;
  reason?: string;
};

/** Live Gemini / structured answers (never canned). */
export type AskModelAnswer =
  | { kind: "prose"; markdown: string }
  | {
      kind: "pokemon_ranking";
      summaryMarkdown?: string;
      items: AskPokemonRankingItem[];
    };

export type AskAnswer =
  | {
      kind: "canned";
      intentId: string;
      markdown: string;
      surfaces: AskSurfaceId[];
    }
  | AskModelAnswer;

/** API / cache wire format — `text` stays for salvage chips + legacy cache. */
export type AskAnswerWire = {
  text: string;
  answer: AskAnswer;
};

/** Flatten an answer for Jump-to salvage matching and session cache keys. */
export function askAnswerToText(answer: AskAnswer): string {
  if (answer.kind === "canned" || answer.kind === "prose") {
    return answer.markdown;
  }
  const lines = [answer.summaryMarkdown ?? ""];
  for (const item of answer.items) {
    lines.push(
      [item.nickname, item.species, item.trainerHandle, item.level, item.reason]
        .filter((v) => v != null && String(v).length)
        .join(" "),
    );
  }
  return lines.filter(Boolean).join("\n");
}
