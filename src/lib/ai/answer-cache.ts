import "server-only";

import { createHash } from "node:crypto";
import { getRedis } from "@/lib/redis";
import type { AskAnswer } from "@/features/search/ask-types";

/**
 * Shared answer cache for Jump Ask (#184 / #300).
 *
 * Same normalized question + same snapshot → same answer. Hits skip Gemini
 * entirely (tokens + latency + free-tier quota). Fail-open: Redis blips fall
 * through to the in-memory map, then to a live call.
 *
 * Keyed without userId so league-wide facts (ROM, rules) amortize across the
 * isolate / KV. Snapshot already embeds season state, so standings stay coherent.
 *
 * Bump REDIS_KEY_PREFIX when prompt/digest semantics change so stale refusals
 * (same question + snapshot, worse answer) are not served for the TTL window.
 */

const MEMORY_TTL_MS = 15 * 60 * 1000;
const REDIS_TTL_SECONDS = 15 * 60;
const MAX_MEMORY_ENTRIES = 200;
const REDIS_KEY_PREFIX = "jump-ask:v3:";

type CachedAnswer = {
  text: string;
  model: string;
  answer: AskAnswer;
};

type MemoryEntry = CachedAnswer & { expiresAt: number };

const memory = new Map<string, MemoryEntry>();

export function normalizeJumpAskQuestion(question: string): string {
  return question.trim().toLowerCase().replace(/\s+/g, " ");
}

/** SHA-256 of snapshot text only — for Ask ops logs (#394), not the plaintext. */
export function jumpAskSnapshotHash(
  snapshot: string | null | undefined,
): string | null {
  const trimmed = snapshot?.trim();
  if (!trimmed) return null;
  return createHash("sha256").update(trimmed).digest("hex");
}

export function jumpAskCacheKey(
  question: string,
  snapshot: string | null | undefined,
  mode = "prose",
): string {
  const payload = `${normalizeJumpAskQuestion(question)}\n---\n${mode}\n---\n${snapshot?.trim() ?? ""}`;
  return createHash("sha256").update(payload).digest("hex");
}

function sweep(now: number): void {
  for (const [key, entry] of memory) {
    if (now >= entry.expiresAt) memory.delete(key);
  }
}

function coerceCached(raw: unknown): CachedAnswer | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as {
    text?: string;
    model?: string;
    answer?: AskAnswer;
  };
  if (!parsed.text || !parsed.model) return null;
  const answer: AskAnswer =
    parsed.answer && typeof parsed.answer === "object" && "kind" in parsed.answer
      ? parsed.answer
      : { kind: "prose", markdown: parsed.text };
  return { text: parsed.text, model: parsed.model, answer };
}

function memoryGet(key: string, now: number): CachedAnswer | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (now >= entry.expiresAt) {
    memory.delete(key);
    return null;
  }
  // Refresh LRU order.
  memory.delete(key);
  memory.set(key, entry);
  return {
    text: entry.text,
    model: entry.model,
    answer: entry.answer,
  };
}

function memorySet(key: string, value: CachedAnswer, now: number): void {
  if (memory.size >= MAX_MEMORY_ENTRIES) {
    sweep(now);
    if (memory.size >= MAX_MEMORY_ENTRIES) {
      const oldest = memory.keys().next().value;
      if (oldest) memory.delete(oldest);
    }
  }
  memory.set(key, { ...value, expiresAt: now + MEMORY_TTL_MS });
}

export async function getCachedJumpAnswer(
  key: string,
): Promise<CachedAnswer | null> {
  const now = Date.now();
  const local = memoryGet(key, now);
  if (local) return local;

  const redis = getRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get<CachedAnswer | string>(`${REDIS_KEY_PREFIX}${key}`);
    if (!raw) return null;
    const parsed =
      typeof raw === "string"
        ? coerceCached(JSON.parse(raw) as unknown)
        : coerceCached(raw);
    if (!parsed) return null;
    memorySet(key, parsed, now);
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedJumpAnswer(
  key: string,
  value: CachedAnswer,
): Promise<void> {
  const now = Date.now();
  memorySet(key, value, now);

  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(`${REDIS_KEY_PREFIX}${key}`, value, {
      ex: REDIS_TTL_SECONDS,
    });
  } catch {
    // Fail-open — memory still holds the entry for this isolate.
  }
}
