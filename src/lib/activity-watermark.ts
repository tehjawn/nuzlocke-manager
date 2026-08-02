/**
 * Tiny activity-feed watermark in Upstash so idle polls skip Neon.
 * Keyed by challenge id. Value is opaque cursor string (`createdAt|id` base64url
 * encoding matches activity pagination cursors).
 */

import { getRedis } from "@/lib/redis";

function headKey(challengeId: string) {
  return `season:${challengeId}:activity:head`;
}

/** Fire-and-forget publish after an activity write. */
export async function publishActivityHead(
  challengeId: string,
  head: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(headKey(challengeId), head);
  } catch {
    // fail-open
  }
}

export async function readActivityHead(
  challengeId: string,
): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const value = await redis.get<string>(headKey(challengeId));
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Encode watermark the same way as activity page cursors. */
export function encodeActivityHead(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString(
    "base64url",
  );
}
