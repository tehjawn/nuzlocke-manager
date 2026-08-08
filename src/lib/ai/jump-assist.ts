import "server-only";

import { google } from "@ai-sdk/google";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import {
  GEMINI_MODEL,
  isGeminiConfigured,
  type GeminiFailureCode,
} from "@/lib/ai/gemini";
import {
  ASK_RANKING_SYSTEM_EXTRA,
  ASK_SYSTEM_PROMPT,
  buildAskUserPrompt,
} from "@/features/search/ask-prompt";
import {
  askAnswerToText,
  type AskModelAnswer,
} from "@/features/search/ask-types";

/**
 * Prompt layer for Jump's Ask mode (#184 / #300).
 *
 * The snapshot is assembled in the browser from data the palette already holds
 * (see `search-digest.ts`) and posted up with the question. It contains
 * player-authored text — Pokémon nicknames, status lines, league rules — so it
 * is fenced and labelled as untrusted data, and the model is told plainly that
 * instructions inside it are not instructions.
 *
 * Structured ranking answers return typed data; React chooses presentation.
 * The model never picks routes or image URLs.
 *
 * System prompt text lives in `ask-prompt.ts` so eval scripts can reuse it.
 */

const REQUEST_TIMEOUT_MS = 10_000;

const rankingItemSchema = z.object({
  species: z.string().min(1).max(40),
  nickname: z.string().max(40).optional(),
  level: z.number().int().min(1).max(100).optional(),
  trainerHandle: z.string().min(1).max(40),
  reason: z.string().max(80).optional(),
});

const askObjectSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("prose"),
    markdown: z.string().min(1).max(1200),
  }),
  z.object({
    kind: z.literal("pokemon_ranking"),
    summaryMarkdown: z.string().max(400).optional(),
    items: z.array(rankingItemSchema).max(8),
  }),
]);

export type JumpAssistAnswer = AskModelAnswer;

export type JumpAssistSuccess = {
  ok: true;
  text: string;
  answer: JumpAssistAnswer;
  model: string;
  usage: { inputTokens?: number; outputTokens?: number };
};

export type JumpAssistResult =
  | JumpAssistSuccess
  | { ok: false; error: string; code: GeminiFailureCode };

export type JumpAssistInput = {
  question: string;
  /** Compact season snapshot from the client, or null on pages without one. */
  snapshot?: string | null;
  /** Prefer a pokemon_ranking card when the client detected a board ranking. */
  preferRanking?: boolean;
  signal?: AbortSignal;
};

function sanitizeAnswer(answer: JumpAssistAnswer): JumpAssistAnswer | null {
  if (answer.kind === "prose") {
    const markdown = answer.markdown.trim();
    if (!markdown) return null;
    return { kind: "prose", markdown };
  }

  const items = answer.items
    .map((item) => ({
      species: item.species.trim(),
      nickname: item.nickname?.trim() || undefined,
      level: item.level,
      trainerHandle: item.trainerHandle.trim(),
      reason: item.reason?.trim() || undefined,
    }))
    .filter((item) => item.species && item.trainerHandle)
    .slice(0, 8);

  if (!items.length) {
    const summary = answer.summaryMarkdown?.trim();
    if (summary) return { kind: "prose", markdown: summary };
    return null;
  }

  return {
    kind: "pokemon_ranking",
    summaryMarkdown: answer.summaryMarkdown?.trim() || undefined,
    items,
  };
}

export async function answerJumpQuestion({
  question,
  snapshot,
  preferRanking = false,
  signal,
}: JumpAssistInput): Promise<JumpAssistResult> {
  if (!isGeminiConfigured()) {
    return {
      ok: false,
      error: "AI assist is not configured on this deployment.",
      code: "NOT_CONFIGURED",
    };
  }

  const prompt = buildAskUserPrompt(question, snapshot);

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const abortSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

  if (preferRanking) {
    try {
      const result = await generateObject({
        model: google(GEMINI_MODEL),
        system: ASK_SYSTEM_PROMPT + ASK_RANKING_SYSTEM_EXTRA,
        prompt,
        schema: askObjectSchema,
        schemaName: "AskAnswer",
        schemaDescription:
          "League Ask answer: prose markdown or a pokemon ranking card.",
        maxRetries: 1,
        abortSignal,
      });

      const sanitized = sanitizeAnswer(result.object);
      if (sanitized) {
        return {
          ok: true,
          text: askAnswerToText(sanitized),
          answer: sanitized,
          model: GEMINI_MODEL,
          usage: {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
          },
        };
      }
    } catch (error) {
      console.error("[answerJumpQuestion:generateObject]", error);
      // Fall through to plain text.
    }
  }

  try {
    const result = await generateText({
      model: google(GEMINI_MODEL),
      system: ASK_SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: 400,
      maxRetries: 1,
      abortSignal,
    });

    const text = result.text.trim();
    if (!text) {
      return {
        ok: false,
        error: "AI assist is unavailable right now.",
        code: "UPSTREAM",
      };
    }

    return {
      ok: true,
      text,
      answer: { kind: "prose", markdown: text },
      model: GEMINI_MODEL,
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
    };
  } catch (error) {
    console.error("[answerJumpQuestion:generateText]", error);
    return {
      ok: false,
      error: "AI assist is unavailable right now.",
      code: "UPSTREAM",
    };
  }
}
