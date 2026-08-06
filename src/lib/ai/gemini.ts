import "server-only";

import { google } from "@ai-sdk/google";
import { generateText } from "ai";

/**
 * Google AI Studio (Gemini) via the Vercel AI SDK — server-only.
 *
 * Path 1 for Jump LLM assist (#184): a plain `GOOGLE_GENERATIVE_AI_API_KEY`
 * against AI Studio's free tier. No AI Gateway, no OIDC, no client-side calls.
 *
 * Fail-open: when the key is unset every entry point here returns a
 * `NOT_CONFIGURED` result instead of throwing, so local dev and deploys
 * without an AI key keep working exactly as before.
 */

/**
 * Cheapest Flash-Lite tier with a free AI Studio quota — $0.25/$1.50 per M
 * input/output tokens if we ever exceed free, vs $0.30/$2.50 for 3.5 Flash-Lite.
 * 3.5 is the faster and stronger model; revisit if assist latency or answer
 * quality disappoints in real use.
 *
 * `gemini-2.5-flash-lite` (the slug #184 researched) now 404s for keys created
 * after its retirement — "no longer available to new users". Pinned to an
 * explicit version rather than the floating `gemini-flash-lite-latest` alias so
 * quality and cost don't shift under us; re-check when this one retires too.
 */
export const GEMINI_MODEL = "gemini-3.1-flash-lite";

/** Keep replies palette-sized; also caps spend if we ever leave the free tier. */
const DEFAULT_MAX_OUTPUT_TOKENS = 256;

/** Jump should never hang on a slow upstream — bail and fall back to fuzzy. */
const REQUEST_TIMEOUT_MS = 10_000;

const DEFAULT_SYSTEM_PROMPT = [
  "You are the assist layer behind Jump, the command palette of a Pokémon",
  "Nuzlocke league tracker. Answer in at most two short sentences.",
  "If you do not know, say so plainly rather than guessing.",
].join(" ");

export type GeminiFailureCode = "NOT_CONFIGURED" | "UPSTREAM";

export type GeminiResult =
  | {
      ok: true;
      text: string;
      model: string;
      usage: { inputTokens?: number; outputTokens?: number };
    }
  | { ok: false; error: string; code: GeminiFailureCode };

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
}

const NOT_CONFIGURED: GeminiResult = {
  ok: false,
  error: "AI assist is not configured on this deployment.",
  code: "NOT_CONFIGURED",
};

export type AskGeminiOptions = {
  prompt: string;
  /** Override the default Jump-flavored system prompt. */
  system?: string;
  maxOutputTokens?: number;
  signal?: AbortSignal;
};

/**
 * Single-shot text completion. Returns a result object rather than throwing so
 * callers can degrade to the existing client-side fuzzy search.
 */
export async function askGemini({
  prompt,
  system = DEFAULT_SYSTEM_PROMPT,
  maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  signal,
}: AskGeminiOptions): Promise<GeminiResult> {
  if (!isGeminiConfigured()) return NOT_CONFIGURED;

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  try {
    const result = await generateText({
      // Reads GOOGLE_GENERATIVE_AI_API_KEY at call time, not import time.
      model: google(GEMINI_MODEL),
      system,
      prompt,
      maxOutputTokens,
      maxRetries: 1,
      abortSignal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });

    return {
      ok: true,
      text: result.text.trim(),
      model: GEMINI_MODEL,
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
    };
  } catch (error) {
    console.error("[askGemini]", error);
    return {
      ok: false,
      error: "AI assist is unavailable right now.",
      code: "UPSTREAM",
    };
  }
}
