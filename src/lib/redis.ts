/**
 * Optional Upstash Redis (Vercel KV) — used only for tiny high-frequency signals.
 * Fail-open: missing env or errors never block the app.
 */

import { Redis } from "@upstash/redis";

let client: Redis | null | undefined;

const UPSTASH_TIMEOUT_MS = 1_500;

export function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL?.trim() &&
      process.env.KV_REST_API_TOKEN?.trim(),
  );
}

export function getRedis(): Redis | null {
  if (!isUpstashConfigured()) return null;
  if (client !== undefined) return client;
  try {
    client = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
      // Fail-open poll path: don't hang the request on a slow KV.
      retry: { retries: 1, backoff: () => 50 },
      signal: () => AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
    });
  } catch {
    client = null;
  }
  return client;
}
