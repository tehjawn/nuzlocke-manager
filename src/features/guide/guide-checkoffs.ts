/**
 * Per-season Game Guide checkoffs.
 * Stored in localStorage only (not the DB) — keyed by season + trainer.
 */

export const GUIDE_CHECKOFFS_CHANGE_EVENT = "nuzlocke-guide-checkoffs-change";

export type GuideCheckoffs = {
  /** Manually completed guide step ids. */
  checkedStepIds: string[];
};

export const EMPTY_GUIDE_CHECKOFFS: GuideCheckoffs = {
  checkedStepIds: [],
};

const cacheByKey = new Map<string, GuideCheckoffs>();

export function guideCheckoffsStorageKey(
  challengeSlug: string,
  trainerId: string | null | undefined,
): string {
  const trainer = trainerId?.trim() || "anon";
  return `nuzlocke-guide-checkoffs:${challengeSlug}:${trainer}`;
}

function normalize(raw: Partial<GuideCheckoffs> | null | undefined): GuideCheckoffs {
  const ids = Array.isArray(raw?.checkedStepIds)
    ? raw.checkedStepIds.filter((id): id is string => typeof id === "string")
    : [];
  return { checkedStepIds: [...new Set(ids)] };
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
    if (stable.checkedStepIds.length === 0) {
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

export function setGuideStepChecked(
  key: string,
  stepId: string,
  checked: boolean,
): GuideCheckoffs {
  const current = readGuideCheckoffs(key);
  const checkedSet = new Set(current.checkedStepIds);
  if (checked) checkedSet.add(stepId);
  else checkedSet.delete(stepId);
  return writeGuideCheckoffs(key, {
    checkedStepIds: [...checkedSet],
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
