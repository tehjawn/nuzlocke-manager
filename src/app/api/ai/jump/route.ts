import { z } from "zod";
import { auth } from "@/auth";
import {
  getCachedJumpAnswer,
  jumpAskCacheKey,
  setCachedJumpAnswer,
} from "@/lib/ai/answer-cache";
import { evaluateAskQuery } from "@/lib/ai/ask-guard";
import { isGeminiConfigured } from "@/lib/ai/gemini";
import { answerJumpQuestion } from "@/lib/ai/jump-assist";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";

/**
 * Authenticated server-only entrypoint for Jump's Ask mode (#184).
 *
 * The client posts a question plus a compact season snapshot it already holds
 * in memory, so answering costs no extra DB read. Fuzzy search stays the
 * default path — this only fires on an explicit Ask.
 *
 * Order matters for free-tier spend: Ask-guard → answer cache → rate limit →
 * Gemini. Gibberish and repeats never touch the RPM/RPD budget.
 *
 * 501 when the key is unset so callers can degrade to fuzzy search silently.
 */

const MAX_SNAPSHOT_CHARS = 8_000;

const askSchema = z.object({
  question: z.string().trim().min(1).max(300),
  /**
   * Compact league snapshot built client-side; absent on global pages.
   * Oversized payloads are truncated (not rejected) so a digest that grew past
   * the ceiling — e.g. truncation suffix past the old hard max — still answers.
   */
  snapshot: z
    .string()
    .nullish()
    .transform((value) =>
      typeof value === "string" ? value.slice(0, MAX_SNAPSHOT_CHARS) : value,
    ),
});

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json(
      { ok: false, error: "Sign in required." },
      { status: 401, headers: NO_STORE },
    );
  }

  if (!isGeminiConfigured()) {
    return Response.json(
      { ok: false, error: "AI assist is not configured.", code: "NOT_CONFIGURED" },
      { status: 501, headers: NO_STORE },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400, headers: NO_STORE },
    );
  }

  const parsed = askSchema.safeParse(body);
  if (!parsed.success) {
    const questionIssue = parsed.error.issues.find((i) =>
      i.path.includes("question"),
    );
    return Response.json(
      {
        ok: false,
        error: questionIssue
          ? "question is required (1–300 characters)"
          : "Invalid ask payload",
      },
      { status: 400, headers: NO_STORE },
    );
  }

  const { question, snapshot } = parsed.data;

  const guard = evaluateAskQuery(question, { allowMultiWord: true });
  if (!guard.ok) {
    return Response.json(
      { ok: false, error: guard.error, code: guard.code },
      { status: 400, headers: NO_STORE },
    );
  }

  const cacheKey = jumpAskCacheKey(question, snapshot);

  const cached = await getCachedJumpAnswer(cacheKey);
  if (cached) {
    return Response.json(
      { ok: true, text: cached.text, model: cached.model, cached: true },
      { status: 200, headers: NO_STORE },
    );
  }

  const limit = await checkAiRateLimit(userId);
  if (!limit.allowed) {
    return Response.json(
      {
        ok: false,
        error:
          limit.scope === "day"
            ? "Daily AI assist limit reached — try again tomorrow."
            : "Slow down a moment, then try again.",
        code: "RATE_LIMITED",
      },
      {
        status: 429,
        headers: {
          ...NO_STORE,
          "Retry-After": String(limit.retryAfterSeconds),
        },
      },
    );
  }

  const result = await answerJumpQuestion({
    question,
    snapshot,
    signal: request.signal,
  });

  if (!result.ok) {
    return Response.json(result, {
      status: result.code === "NOT_CONFIGURED" ? 501 : 502,
      headers: NO_STORE,
    });
  }

  await setCachedJumpAnswer(cacheKey, {
    text: result.text,
    model: result.model,
  });

  return Response.json(
    { ok: true, text: result.text, model: result.model },
    { status: 200, headers: NO_STORE },
  );
}
