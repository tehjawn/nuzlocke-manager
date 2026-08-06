import { z } from "zod";
import { auth } from "@/auth";
import { askGemini, isGeminiConfigured } from "@/lib/ai/gemini";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";

/**
 * Authenticated server-only entrypoint for the Jump LLM assist (#184).
 *
 * Infra only for now: nothing in the palette calls this yet. It exists so the
 * Gemini path can be smoke-tested end to end before any UX is designed.
 *
 * 501 when the key is unset so callers can degrade to fuzzy search silently.
 */

const askSchema = z.object({
  prompt: z.string().trim().min(1).max(500),
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
      { ok: false, error: "prompt is required (1–500 characters)" },
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

  const result = await askGemini({
    prompt: parsed.data.prompt,
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
