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
