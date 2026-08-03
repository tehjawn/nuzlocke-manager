/**
 * Per-season Team Planner drafts.
 * Stored in localStorage only (not the DB) — keyed by season + trainer.
 */

export const PLANNER_DRAFT_CHANGE_EVENT = "nuzlocke-planner-draft-change";

export type PlannerDraft = {
  /** Ordered board entry ids for the planned Main (max 6). */
  entryIds: string[];
};

export const EMPTY_PLANNER_DRAFT: PlannerDraft = {
  entryIds: [],
};

const MAX_DRAFT = 6;
const cacheByKey = new Map<string, PlannerDraft>();

export function plannerDraftStorageKey(
  challengeSlug: string,
  trainerId: string | null | undefined,
): string {
  const trainer = trainerId?.trim() || "anon";
  return `nuzlocke-planner-draft:${challengeSlug}:${trainer}`;
}

function normalize(raw: Partial<PlannerDraft> | null | undefined): PlannerDraft {
  const ids = Array.isArray(raw?.entryIds)
    ? raw.entryIds.filter((id): id is string => typeof id === "string")
    : [];
  return { entryIds: [...new Set(ids)].slice(0, MAX_DRAFT) };
}

function loadFromStorage(key: string): PlannerDraft {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return EMPTY_PLANNER_DRAFT;
    return normalize(JSON.parse(stored) as Partial<PlannerDraft>);
  } catch {
    return EMPTY_PLANNER_DRAFT;
  }
}

export function readPlannerDraft(key: string): PlannerDraft {
  if (typeof window === "undefined") return EMPTY_PLANNER_DRAFT;
  const cached = cacheByKey.get(key);
  if (cached) return cached;
  const loaded = loadFromStorage(key);
  cacheByKey.set(key, loaded);
  return loaded;
}

function notify(key: string) {
  window.dispatchEvent(
    new CustomEvent(PLANNER_DRAFT_CHANGE_EVENT, { detail: { key } }),
  );
}

export function writePlannerDraft(key: string, next: PlannerDraft): PlannerDraft {
  const stable = normalize(next);
  cacheByKey.set(key, stable);
  try {
    if (stable.entryIds.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(stable));
    }
  } catch {
    // private mode / blocked storage
  }
  notify(key);
  return stable;
}

export function setPlannerDraftIds(
  key: string,
  entryIds: readonly string[],
): PlannerDraft {
  return writePlannerDraft(key, { entryIds: [...entryIds] });
}

export function clearPlannerDraft(key: string): PlannerDraft {
  return writePlannerDraft(key, EMPTY_PLANNER_DRAFT);
}

/** Max planned Main size. */
export const PLANNER_DRAFT_MAX = MAX_DRAFT;
