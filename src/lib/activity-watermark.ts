/**
 * Tiny activity-feed watermark in Upstash so idle polls skip Neon.
 * Keyed by challenge id. Combines newest ActivityEvent cursor + reaction rev
 * so reaction toggles invalidate the short-circuit even when the event head
 * is unchanged.
 */

import { getRedis } from "@/lib/redis";

function headKey(challengeId: string) {
  return `season:${challengeId}:activity:head`;
}

function reactionKey(challengeId: string) {
  return `season:${challengeId}:activity:rx`;
}

function combineHead(activityHead: string, reactionRev: string | number) {
  return `${activityHead}|rx:${reactionRev}`;
}

async function readReactionRev(
  redis: NonNullable<ReturnType<typeof getRedis>>,
  challengeId: string,
): Promise<string> {
  try {
    const value = await redis.get<string | number>(reactionKey(challengeId));
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === "string" && value.length > 0) return value;
  } catch {
    // fail-open
  }
  return "0";
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

/** Bump reaction generation so idle polls refetch reaction counts. */
export async function bumpActivityReactionRev(
  challengeId: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.incr(reactionKey(challengeId));
  } catch {
    // fail-open
  }
}

/**
 * Combined watermark for poll short-circuit.
 * Returns null when the activity head is missing (cold cache).
 */
export async function readActivityHead(
  challengeId: string,
): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const activityHead = await redis.get<string>(headKey(challengeId));
    if (typeof activityHead !== "string" || activityHead.length === 0) {
      return null;
    }
    const rx = await readReactionRev(redis, challengeId);
    return combineHead(activityHead, rx);
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

/** Attach reaction rev to a DB activity head for client watermarks. */
export async function withReactionHead(
  challengeId: string,
  activityHead: string | null | undefined,
): Promise<string | null> {
  if (!activityHead) return activityHead ?? null;
  const redis = getRedis();
  if (!redis) return activityHead;
  const rx = await readReactionRev(redis, challengeId);
  return combineHead(activityHead, rx);
}
