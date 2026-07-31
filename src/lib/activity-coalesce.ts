import { listLabels, summarizeBadgeBatch, summarizeDeathBatch } from "@/lib/activity-messages";

/** Match social notification grouping — quiet window before a new feed row. */
export const ACTIVITY_COALESCE_WINDOW_MS = 15 * 60 * 1000;

export type ActivityCoalesceCategory =
  | "badges"
  | "deaths"
  | "catches"
  | "rules"
  | "status"
  | "locks";

export type BadgeCoalesceMeta = {
  category: "badges";
  earned: string[];
  lost: string[];
};

export type LabelsCoalesceMeta = {
  category: "deaths" | "catches";
  labels: string[];
};

export type RulesCoalesceMeta = { category: "rules" };
export type StatusCoalesceMeta = { category: "status" };
export type LocksCoalesceMeta = { category: "locks"; handles: string[] };

export type ActivityCoalesceMeta =
  | BadgeCoalesceMeta
  | LabelsCoalesceMeta
  | RulesCoalesceMeta
  | StatusCoalesceMeta
  | LocksCoalesceMeta;

export function parseActivityCoalesceMeta(
  raw: unknown,
): ActivityCoalesceMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const category = (raw as { category?: unknown }).category;
  if (category === "badges") {
    const earned = Array.isArray((raw as BadgeCoalesceMeta).earned)
      ? (raw as BadgeCoalesceMeta).earned.filter((x) => typeof x === "string")
      : [];
    const lost = Array.isArray((raw as BadgeCoalesceMeta).lost)
      ? (raw as BadgeCoalesceMeta).lost.filter((x) => typeof x === "string")
      : [];
    return { category: "badges", earned, lost };
  }
  if (category === "deaths" || category === "catches") {
    const labels = Array.isArray((raw as LabelsCoalesceMeta).labels)
      ? (raw as LabelsCoalesceMeta).labels.filter((x) => typeof x === "string")
      : [];
    return { category, labels };
  }
  if (category === "locks") {
    const handles = Array.isArray((raw as LocksCoalesceMeta).handles)
      ? (raw as LocksCoalesceMeta).handles.filter((x) => typeof x === "string")
      : [];
    return { category: "locks", handles };
  }
  if (category === "rules") return { category: "rules" };
  if (category === "status") return { category: "status" };
  return null;
}

/** Apply earn/lose toggles onto a prior badge coalesce bucket. */
export function mergeBadgeCoalesce(
  prev: BadgeCoalesceMeta | null,
  earned: string[],
  lost: string[],
): BadgeCoalesceMeta {
  const earnedList = [...(prev?.earned ?? [])];
  const lostList = [...(prev?.lost ?? [])];
  const earnedSet = new Set(earnedList);
  const lostSet = new Set(lostList);

  for (const label of earned) {
    if (!earnedSet.has(label)) {
      earnedList.push(label);
      earnedSet.add(label);
    }
    if (lostSet.delete(label)) {
      const idx = lostList.indexOf(label);
      if (idx >= 0) lostList.splice(idx, 1);
    }
  }
  for (const label of lost) {
    if (!lostSet.has(label)) {
      lostList.push(label);
      lostSet.add(label);
    }
    if (earnedSet.delete(label)) {
      const idx = earnedList.indexOf(label);
      if (idx >= 0) earnedList.splice(idx, 1);
    }
  }

  return { category: "badges", earned: earnedList, lost: lostList };
}

export function mergeLabelsCoalesce(
  category: "deaths" | "catches",
  prev: LabelsCoalesceMeta | null,
  labels: string[],
): LabelsCoalesceMeta {
  const list = [...(prev?.labels ?? [])];
  const seen = new Set(list);
  for (const label of labels) {
    if (!seen.has(label)) {
      list.push(label);
      seen.add(label);
    }
  }
  return { category, labels: list };
}

export function mergeLocksCoalesce(
  prev: LocksCoalesceMeta | null,
  handles: string[],
): LocksCoalesceMeta {
  const list = [...(prev?.handles ?? [])];
  const seen = new Set(list);
  for (const handle of handles) {
    if (!seen.has(handle)) {
      list.push(handle);
      seen.add(handle);
    }
  }
  return { category: "locks", handles: list };
}

export function summarizeCatchBatch(
  handle: string,
  labels: string[],
): string | null {
  if (labels.length === 0) return null;
  return `${handle} logged ${listLabels(labels)}`;
}

export function summarizeLocksBatch(handles: string[]): string | null {
  if (handles.length === 0) return null;
  if (handles.length === 1) return `${handles[0]}'s Main Squad locked`;
  return `Main Squad locked for ${listLabels(handles)}`;
}

export function resolveBadgeCoalesce(
  handle: string,
  prev: ActivityCoalesceMeta | null,
  earned: string[],
  lost: string[],
) {
  const meta = mergeBadgeCoalesce(
    prev?.category === "badges" ? prev : null,
    earned,
    lost,
  );
  const summary = summarizeBadgeBatch(handle, meta.earned, meta.lost);
  if (!summary) return null;
  return { ...summary, metadata: meta };
}

export function resolveDeathCoalesce(
  handle: string,
  prev: ActivityCoalesceMeta | null,
  labels: string[],
) {
  const meta = mergeLabelsCoalesce(
    "deaths",
    prev?.category === "deaths" ? prev : null,
    labels,
  );
  const message = summarizeDeathBatch(handle, meta.labels);
  if (!message) return null;
  return { type: "DEATH" as const, message, metadata: meta };
}

export function resolveCatchCoalesce(
  handle: string,
  prev: ActivityCoalesceMeta | null,
  labels: string[],
) {
  const meta = mergeLabelsCoalesce(
    "catches",
    prev?.category === "catches" ? prev : null,
    labels,
  );
  const message = summarizeCatchBatch(handle, meta.labels);
  if (!message) return null;
  return { type: "CATCH" as const, message, metadata: meta };
}

export function resolveRulesCoalesce() {
  return {
    type: "RULE_UPDATED" as const,
    message: "Rules updated by Game Master",
    metadata: { category: "rules" } satisfies RulesCoalesceMeta,
  };
}

export function resolveStatusCoalesce(handle: string) {
  return {
    type: "STATUS_UPDATE" as const,
    message: `${handle} updated status`,
    metadata: { category: "status" } satisfies StatusCoalesceMeta,
  };
}

export function resolveLocksCoalesce(
  prev: ActivityCoalesceMeta | null,
  handles: string[],
) {
  const meta = mergeLocksCoalesce(
    prev?.category === "locks" ? prev : null,
    handles,
  );
  const message = summarizeLocksBatch(meta.handles);
  if (!message) return null;
  return {
    type: "MAIN_SQUAD_LOCKED" as const,
    message,
    metadata: meta,
  };
}
