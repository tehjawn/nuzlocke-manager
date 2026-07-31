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
 * Collapse consecutive identical RULE_UPDATED rows (historical GM spam).
 * Items are newest-first. Keeps the newest row in each run.
 */
export function coalesceActivityItems(items: ActivityItem[]): ActivityItem[] {
  if (items.length <= 1) return items;
  const out: ActivityItem[] = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.type === "RULE_UPDATED" &&
      item.type === "RULE_UPDATED" &&
      prev.message === item.message
    ) {
      continue;
    }
    out.push(item);
  }
  return out;
}
