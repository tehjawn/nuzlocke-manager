/**
 * Per-season Game Guide checkoffs.
 * localStorage + custom event + useSyncExternalStore (same idea as fx-prefs).
 */

export const GUIDE_CHECKOFFS_CHANGE_EVENT = "nuzlocke-guide-checkoffs-change";

export type GuideCheckoffs = {
  /** Manually completed guide step ids. */
  checkedStepIds: string[];
  /** Steps the player un-checked, overriding board-derived completion. */
  uncheckedStepIds: string[];
};

export const EMPTY_GUIDE_CHECKOFFS: GuideCheckoffs = {
  checkedStepIds: [],
  uncheckedStepIds: [],
};

const cacheByKey = new Map<string, GuideCheckoffs>();

export function guideCheckoffsStorageKey(
  challengeSlug: string,
  trainerId: string | null | undefined,
): string {
  const trainer = trainerId?.trim() || "anon";
  return `nuzlocke-guide-checkoffs:${challengeSlug}:${trainer}`;
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string"))];
}

function normalize(raw: Partial<GuideCheckoffs> | null | undefined): GuideCheckoffs {
  return {
    checkedStepIds: uniqueStrings(raw?.checkedStepIds),
    uncheckedStepIds: uniqueStrings(raw?.uncheckedStepIds),
  };
}

function loadFromStorage(key: string): GuideCheckoffs {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return EMPTY_GUIDE_CHECKOFFS;
    return normalize(JSON.parse(stored) as Partial<GuideCheckoffs>);
  } catch {
    return EMPTY_GUIDE_CHECKOFFS;
  }
}

export function readGuideCheckoffs(key: string): GuideCheckoffs {
  if (typeof window === "undefined") return EMPTY_GUIDE_CHECKOFFS;
  const cached = cacheByKey.get(key);
  if (cached) return cached;
  const loaded = loadFromStorage(key);
  cacheByKey.set(key, loaded);
  return loaded;
}

function notify(key: string) {
  window.dispatchEvent(
    new CustomEvent(GUIDE_CHECKOFFS_CHANGE_EVENT, { detail: { key } }),
  );
}

export function writeGuideCheckoffs(
  key: string,
  next: GuideCheckoffs,
): GuideCheckoffs {
  const stable = normalize(next);
  cacheByKey.set(key, stable);
  try {
    const isEmpty =
      stable.checkedStepIds.length === 0 &&
      stable.uncheckedStepIds.length === 0;
    if (isEmpty) {
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

/**
 * Record an explicit choice for a step. Both sets are written so a manual
 * choice always beats board-derived inference in either direction.
 */
export function setGuideStepChecked(
  key: string,
  stepId: string,
  checked: boolean,
): GuideCheckoffs {
  const current = readGuideCheckoffs(key);
  const checkedSet = new Set(current.checkedStepIds);
  const uncheckedSet = new Set(current.uncheckedStepIds);

  if (checked) {
    checkedSet.add(stepId);
    uncheckedSet.delete(stepId);
  } else {
    checkedSet.delete(stepId);
    uncheckedSet.add(stepId);
  }

  return writeGuideCheckoffs(key, {
    checkedStepIds: [...checkedSet],
    uncheckedStepIds: [...uncheckedSet],
  });
}

export function clearGuideCheckoffs(key: string): GuideCheckoffs {
  return writeGuideCheckoffs(key, EMPTY_GUIDE_CHECKOFFS);
}

/** Subscribe for `useSyncExternalStore` (same-tab + cross-tab). */
export function subscribeGuideCheckoffs(
  key: string,
  onStoreChange: () => void,
): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key !== key && event.key !== null) return;
    cacheByKey.set(key, loadFromStorage(key));
    onStoreChange();
  }
  function onCustom(event: Event) {
    const detail = (event as CustomEvent<{ key?: string }>).detail;
    if (detail?.key && detail.key !== key) return;
    onStoreChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(GUIDE_CHECKOFFS_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(GUIDE_CHECKOFFS_CHANGE_EVENT, onCustom);
  };
}
