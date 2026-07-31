import type { ActivityItem } from "@/lib/challenge-types";

/** Oxford-comma list: "A", "A and B", "A, B, and C". */
export function listLabels(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export type BadgeBatchActivity = {
  type: "BADGE_EARNED" | "BADGE_REVOKED" | "NOTE";
  message: string;
};

/** One Pack-feed line for a multi-badge toggle flush. */
export function summarizeBadgeBatch(
  handle: string,
  earnedLabels: string[],
  lostLabels: string[],
): BadgeBatchActivity | null {
  if (earnedLabels.length === 0 && lostLabels.length === 0) return null;

  const parts: string[] = [];
  if (earnedLabels.length > 0) {
    parts.push(`earned ${listLabels(earnedLabels)}`);
  }
  if (lostLabels.length > 0) {
    parts.push(`lost ${listLabels(lostLabels)}`);
  }

  const message = `${handle} ${parts.join(" and ")}`;

  if (earnedLabels.length > 0 && lostLabels.length > 0) {
    return { type: "NOTE", message };
  }
  if (earnedLabels.length > 0) {
    return { type: "BADGE_EARNED", message };
  }
  return { type: "BADGE_REVOKED", message };
}

/** One Pack-feed / Discord line for multi-mon memorial relocates. */
export function summarizeDeathBatch(
  handle: string,
  labels: string[],
): string | null {
  if (labels.length === 0) return null;
  return `${handle} memorialized ${listLabels(labels)}`;
}

/**
 * Collapse consecutive feed spam (newest-first).
 * Write-time coalesce handles live merges; this cleans historical duplicates
 * for categories that keep an identical message (rules / status).
 */
export function coalesceActivityItems(items: ActivityItem[]): ActivityItem[] {
  if (items.length <= 1) return items;
  const out: ActivityItem[] = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    if (prev && shouldCollapseFeedItems(prev, item)) {
      continue;
    }
    out.push(item);
  }
  return out;
}

function shouldCollapseFeedItems(newer: ActivityItem, older: ActivityItem) {
  if (newer.message !== older.message) return false;
  if (newer.trainerHandle !== older.trainerHandle) return false;

  if (
    newer.type === "RULE_UPDATED" &&
    older.type === "RULE_UPDATED"
  ) {
    return true;
  }
  if (
    newer.type === "STATUS_UPDATE" &&
    older.type === "STATUS_UPDATE"
  ) {
    const dt = Math.abs(
      new Date(newer.createdAt).getTime() - new Date(older.createdAt).getTime(),
    );
    return dt <= 15 * 60 * 1000;
  }
  return false;
}
