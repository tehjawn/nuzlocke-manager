import { z } from "zod";
import { auth } from "@/auth";
import {
  getCachedJumpAnswer,
  jumpAskCacheKey,
  jumpAskSnapshotHash,
  setCachedJumpAnswer,
} from "@/lib/ai/answer-cache";
import { evaluateAskQuery } from "@/lib/ai/ask-guard";
import { logAiAskRun, type AiAskLogStatus } from "@/lib/ai/ask-log";
import { isGeminiConfigured } from "@/lib/ai/gemini";
import { answerJumpQuestion } from "@/lib/ai/jump-assist";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import type { AskAnswer } from "@/features/search/ask-types";

/**
 * Authenticated server-only entrypoint for Jump's Ask mode (#184 / #300).
 *
 * The client posts a question plus a compact season snapshot it already holds
 * in memory, so answering costs no extra DB read. Fuzzy search stays the
 * default path — this only fires on an explicit Ask.
 *
 * Order matters for free-tier spend: Ask-guard → answer cache → rate limit →
 * Gemini. Gibberish and repeats never touch the RPM/RPD budget.
 *
 * Each authenticated outcome is appended to AiAskLog for ops (#394). Logging
 * never fails the Ask response.
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
  /** Client detected a board ranking — prefer structured pokemon_ranking. */
  preferRanking: z.boolean().optional(),
  /** Optional season id when Ask is opened from a challenge workspace. */
  challengeId: z.string().trim().min(1).max(64).nullish(),
});

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

type LogFields = {
  userId: string;
  challengeId?: string | null;
  question: string;
  preferRanking: boolean;
  snapshotHash: string | null;
  startedAt: number;
};

async function recordAsk(
  fields: LogFields,
  extra: {
    status: AiAskLogStatus;
    answer?: AskAnswer | null;
    model?: string | null;
    cached?: boolean;
    inputTokens?: number | null;
    outputTokens?: number | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
): Promise<void> {
  await logAiAskRun({
    userId: fields.userId,
    challengeId: fields.challengeId,
    question: fields.question,
    preferRanking: fields.preferRanking,
    snapshotHash: fields.snapshotHash,
    latencyMs: performance.now() - fields.startedAt,
    ...extra,
  });
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json(
      { ok: false, error: "Sign in required." },
      { status: 401, headers: NO_STORE },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    await logAiAskRun({
      userId,
      question: "",
      status: "bad_request",
      errorCode: "INVALID_JSON",
      errorMessage: "Invalid JSON body",
      latencyMs: performance.now() - startedAt,
    });
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
    const rawQuestion =
      typeof body === "object" &&
      body &&
      "question" in body &&
      typeof (body as { question: unknown }).question === "string"
        ? (body as { question: string }).question.slice(0, 300)
        : "";
    await logAiAskRun({
      userId,
      question: rawQuestion,
      status: "bad_request",
      errorCode: "INVALID_PAYLOAD",
      errorMessage: questionIssue
        ? "question is required (1–300 characters)"
        : "Invalid ask payload",
      latencyMs: performance.now() - startedAt,
    });
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

  const { question, snapshot, preferRanking, challengeId } = parsed.data;
  const prefer = Boolean(preferRanking);
  const logBase: LogFields = {
    userId,
    challengeId: challengeId ?? null,
    question,
    preferRanking: prefer,
    snapshotHash: jumpAskSnapshotHash(snapshot),
    startedAt,
  };

  if (!isGeminiConfigured()) {
    await recordAsk(logBase, {
      status: "not_configured",
      errorCode: "NOT_CONFIGURED",
      errorMessage: "AI assist is not configured.",
    });
    return Response.json(
      { ok: false, error: "AI assist is not configured.", code: "NOT_CONFIGURED" },
      { status: 501, headers: NO_STORE },
    );
  }

  const guard = evaluateAskQuery(question, { allowMultiWord: true });
  if (!guard.ok) {
    await recordAsk(logBase, {
      status: "guard_blocked",
      errorCode: guard.code,
      errorMessage: guard.error,
    });
    return Response.json(
      { ok: false, error: guard.error, code: guard.code },
      { status: 400, headers: NO_STORE },
    );
  }

  const cacheKey = jumpAskCacheKey(
    question,
    snapshot,
    prefer ? "rank" : "prose",
  );

  const cached = await getCachedJumpAnswer(cacheKey);
  if (cached) {
    await recordAsk(logBase, {
      status: "cached",
      answer: cached.answer,
      model: cached.model,
      cached: true,
    });
    return Response.json(
      {
        ok: true,
        text: cached.text,
        answer: cached.answer,
        model: cached.model,
        cached: true,
      },
      { status: 200, headers: NO_STORE },
    );
  }

  const limit = await checkAiRateLimit(userId);
  if (!limit.allowed) {
    await recordAsk(logBase, {
      status: "rate_limited",
      errorCode: "RATE_LIMITED",
      errorMessage:
        limit.scope === "day"
          ? "Daily AI assist limit reached — try again tomorrow."
          : "Slow down a moment, then try again.",
    });
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
    preferRanking: prefer,
    signal: request.signal,
  });

  if (!result.ok) {
    const status: AiAskLogStatus =
      result.code === "NOT_CONFIGURED" ? "not_configured" : "upstream_error";
    await recordAsk(logBase, {
      status,
      errorCode: result.code,
      errorMessage: result.error,
    });
    return Response.json(result, {
      status: result.code === "NOT_CONFIGURED" ? 501 : 502,
      headers: NO_STORE,
    });
  }

  await setCachedJumpAnswer(cacheKey, {
    text: result.text,
    answer: result.answer,
    model: result.model,
  });

  await recordAsk(logBase, {
    status: "ok",
    answer: result.answer,
    model: result.model,
    cached: false,
    inputTokens: result.usage.inputTokens ?? null,
    outputTokens: result.usage.outputTokens ?? null,
  });

  return Response.json(
    {
      ok: true,
      text: result.text,
      answer: result.answer,
      model: result.model,
    },
    { status: 200, headers: NO_STORE },
  );
}
