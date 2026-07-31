import type { ActivityItem } from "@/lib/challenge-types";

/** List names in the feed until this many; above that, use a count summary. */
export const ACTIVITY_NAME_LIMIT = 3;

/** Oxford-comma list: "A", "A and B", "A, B, and C". */
export function listLabels(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

/**
 * Small batches keep concrete names; larger ones collapse to "N widgets"
 * so Pack feed / Discord lines stay scannable (FB/IG-style truncation).
 */
export function formatNamedGroup(
  labels: string[],
  nouns: { singular: string; plural: string },
): string {
  if (labels.length === 0) return "";
  if (labels.length <= ACTIVITY_NAME_LIMIT) return listLabels(labels);
  return `${labels.length} ${nouns.plural}`;
}

export type BadgeBatchActivity = {
  type: "BADGE_EARNED" | "BADGE_REVOKED" | "NOTE";
  message: string;
};

/** One Pack-feed line for a multi-badge toggle / coalesce bucket. */
export function summarizeBadgeBatch(
  handle: string,
  earnedLabels: string[],
  lostLabels: string[],
): BadgeBatchActivity | null {
  if (earnedLabels.length === 0 && lostLabels.length === 0) return null;

  const earnedCount = earnedLabels.length;
  const lostCount = lostLabels.length;
  const total = earnedCount + lostCount;

  // Mixed earn+lose with a fat set → one compact "updated N badges" line.
  if (
    earnedCount > 0 &&
    lostCount > 0 &&
    (earnedCount > ACTIVITY_NAME_LIMIT ||
      lostCount > ACTIVITY_NAME_LIMIT ||
      total > ACTIVITY_NAME_LIMIT)
  ) {
    return {
      type: "NOTE",
      message: `${handle} updated ${total} badges`,
    };
  }

  const parts: string[] = [];
  if (earnedCount > 0) {
    parts.push(
      `earned ${formatNamedGroup(earnedLabels, {
        singular: "badge",
        plural: "badges",
      })}`,
    );
  }
  if (lostCount > 0) {
    parts.push(
      `lost ${formatNamedGroup(lostLabels, {
        singular: "badge",
        plural: "badges",
      })}`,
    );
  }

  const message = `${handle} ${parts.join(" and ")}`;

  if (earnedCount > 0 && lostCount > 0) {
    return { type: "NOTE", message };
  }
  if (earnedCount > 0) {
    return { type: "BADGE_EARNED", message };
  }
  return { type: "BADGE_REVOKED", message };
}

/** One Pack-feed / Discord line for multi-mon memorials. */
export function summarizeDeathBatch(
  handle: string,
  labels: string[],
): string | null {
  if (labels.length === 0) return null;
  return `${handle} memorialized ${formatNamedGroup(labels, {
    singular: "Pokémon",
    plural: "Pokémon",
  })}`;
}

/** One Pack-feed line for multi-catch logging. */
export function summarizeCatchBatch(
  handle: string,
  labels: string[],
): string | null {
  if (labels.length === 0) return null;
  return `${handle} logged ${formatNamedGroup(labels, {
    singular: "Pokémon",
    plural: "Pokémon",
  })}`;
}

/** One Pack-feed line for bulk Main Squad locks by a GM. */
export function summarizeLocksBatch(handles: string[]): string | null {
  if (handles.length === 0) return null;
  if (handles.length === 1) return `${handles[0]}'s Main Squad locked`;
  if (handles.length <= ACTIVITY_NAME_LIMIT) {
    return `Main Squad locked for ${listLabels(handles)}`;
  }
  return `Main Squad locked for ${handles.length} trainers`;
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
