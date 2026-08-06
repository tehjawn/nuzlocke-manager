import "server-only";

import { getRedis } from "@/lib/redis";

/**
 * Per-user rate limit for the Gemini assist path (#184).
 *
 * Prefers Upstash Redis so limits hold across Vercel isolates. Falls back to
 * in-memory when KV is unset or errors (fail-open for availability — still
 * slows a single hot isolate).
 *
 * Only call after Ask-guard + cache miss so gibberish / repeats don't burn
 * the free-tier budget.
 */

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Deliberately well under any Flash-Lite free-tier per-minute budget. */
export const AI_MAX_PER_MINUTE = 5;
/** Deliberately well under any Flash-Lite free-tier per-day budget. */
export const AI_MAX_PER_DAY = 50;

const REDIS_PREFIX = "ai-rl:v1:";

type Window = { count: number; resetAt: number };
type Buckets = { minute: Window; day: Window };

const memory = new Map<string, Buckets>();
const MAX_TRACKED_USERS = 5_000;

export type RateLimitResult =
  | { allowed: true; remainingToday: number }
  | { allowed: false; retryAfterSeconds: number; scope: "minute" | "day" };

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
  for (const [key, bucket] of memory) {
    if (now >= bucket.day.resetAt) memory.delete(key);
  }
}

function checkMemory(userId: string): RateLimitResult {
  const now = Date.now();

  if (memory.size > MAX_TRACKED_USERS) sweep(now);

  let bucket = memory.get(userId);
  if (!bucket) {
    bucket = {
      minute: { count: 0, resetAt: now + MINUTE_MS },
      day: { count: 0, resetAt: now + DAY_MS },
    };
    memory.set(userId, bucket);
  }

  if (!hit(bucket.minute, AI_MAX_PER_MINUTE, now, MINUTE_MS)) {
    return {
      allowed: false,
      scope: "minute",
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.minute.resetAt - now) / 1000),
      ),
    };
  }

  if (!hit(bucket.day, AI_MAX_PER_DAY, now, DAY_MS)) {
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

  return { allowed: true, remainingToday: AI_MAX_PER_DAY - bucket.day.count };
}

async function incrWindow(
  key: string,
  limit: number,
  ttlSeconds: number,
): Promise<{ count: number; over: boolean }> {
  const redis = getRedis();
  if (!redis) throw new Error("redis unavailable");

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }
  return { count, over: count > limit };
}

async function checkRedis(userId: string): Promise<RateLimitResult> {
  const now = Date.now();
  const minuteId = Math.floor(now / MINUTE_MS);
  const dayId = Math.floor(now / DAY_MS);
  const minuteKey = `${REDIS_PREFIX}m:${userId}:${minuteId}`;
  const dayKey = `${REDIS_PREFIX}d:${userId}:${dayId}`;

  const minute = await incrWindow(minuteKey, AI_MAX_PER_MINUTE, 120);
  if (minute.over) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(((minuteId + 1) * MINUTE_MS - now) / 1000),
    );
    return { allowed: false, scope: "minute", retryAfterSeconds };
  }

  const day = await incrWindow(dayKey, AI_MAX_PER_DAY, 60 * 60 * 26);
  if (day.over) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(((dayId + 1) * DAY_MS - now) / 1000),
    );
    return { allowed: false, scope: "day", retryAfterSeconds };
  }

  return {
    allowed: true,
    remainingToday: Math.max(0, AI_MAX_PER_DAY - day.count),
  };
}

export async function checkAiRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (redis) {
    try {
      return await checkRedis(userId);
    } catch {
      // Fail open to memory — still rate-limits within this isolate.
    }
  }
  return checkMemory(userId);
}
