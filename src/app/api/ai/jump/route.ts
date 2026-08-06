import { z } from "zod";
import { auth } from "@/auth";
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
 * 501 when the key is unset so callers can degrade to fuzzy search silently.
 */

const askSchema = z.object({
  question: z.string().trim().min(1).max(300),
  /** Compact league snapshot built client-side; absent on global pages. */
  snapshot: z.string().max(8_000).nullish(),
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
    return Response.json(
      { ok: false, error: "question is required (1–300 characters)" },
      { status: 400, headers: NO_STORE },
    );
  }

  const limit = checkAiRateLimit(userId);
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
    question: parsed.data.question,
    snapshot: parsed.data.snapshot,
    signal: request.signal,
  });

  if (!result.ok) {
    return Response.json(result, {
      status: result.code === "NOT_CONFIGURED" ? 501 : 502,
      headers: NO_STORE,
    });
  }

  return Response.json(
    { ok: true, text: result.text, model: result.model },
    { status: 200, headers: NO_STORE },
  );
}
