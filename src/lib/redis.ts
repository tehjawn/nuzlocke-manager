/**
 * Optional Upstash Redis (Vercel KV) — used only for tiny high-frequency signals.
 * Fail-open: missing env or errors never block the app.
 */

import { Redis } from "@upstash/redis";

let client: Redis | null | undefined;

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
    });
  } catch {
    client = null;
  }
  return client;
}
