import "server-only";

/**
 * Naive per-user rate limit for the Gemini assist path (#184).
 *
 * In-memory and therefore per-isolate: on Vercel this is best-effort, not a
 * hard ceiling. It exists to stop one signed-in user from burning the AI
 * Studio free-tier RPM/RPD quota in a loop, not to be exact.
 *
 * Follow-up: move to Upstash/KV (`src/lib/redis.ts` already fails open) once
 * the assist path is more than an experiment.
 */

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Deliberately well under any Flash-Lite free-tier per-minute budget. */
const MAX_PER_MINUTE = 5;
/** Deliberately well under any Flash-Lite free-tier per-day budget. */
const MAX_PER_DAY = 50;

type Window = { count: number; resetAt: number };
type Buckets = { minute: Window; day: Window };

const buckets = new Map<string, Buckets>();

/** Keep the map from growing without bound in a long-lived isolate. */
const MAX_TRACKED_USERS = 5_000;

function hit(window: Window, limit: number, now: number, span: number): boolean {
  if (now >= window.resetAt) {
    window.count = 0;
    window.resetAt = now + span;
  }
  if (window.count >= limit) return false;
  window.count += 1;
  return true;
}

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.day.resetAt) buckets.delete(key);
  }
}

export type RateLimitResult =
  | { allowed: true; remainingToday: number }
  | { allowed: false; retryAfterSeconds: number; scope: "minute" | "day" };

export function checkAiRateLimit(userId: string): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_USERS) sweep(now);

  let bucket = buckets.get(userId);
  if (!bucket) {
    bucket = {
      minute: { count: 0, resetAt: now + MINUTE_MS },
      day: { count: 0, resetAt: now + DAY_MS },
    };
    buckets.set(userId, bucket);
  }

  if (!hit(bucket.minute, MAX_PER_MINUTE, now, MINUTE_MS)) {
    return {
      allowed: false,
      scope: "minute",
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.minute.resetAt - now) / 1000),
      ),
    };
  }

  if (!hit(bucket.day, MAX_PER_DAY, now, DAY_MS)) {
    // Daily cap hit — refund the minute tick we just spent.
    bucket.minute.count -= 1;
    return {
      allowed: false,
      scope: "day",
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.day.resetAt - now) / 1000),
      ),
    };
  }

  return { allowed: true, remainingToday: MAX_PER_DAY - bucket.day.count };
}
