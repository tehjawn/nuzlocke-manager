/**
 * Progressive Get Started section checkoffs (issue #183).
 * localStorage only — keyed by season + trainer (or anon).
 */

import { withOrderedPrefixCheck } from "@/lib/ordered-prefix-check";

export const SETUP_CHECKOFFS_CHANGE_EVENT = "nuzlocke-setup-checkoffs-change";

export const SETUP_SECTION_IDS = [
  "welcome",
  "rom",
  "afterplay",
  "gamemode",
  "import",
] as const;

export type SetupSectionId = (typeof SETUP_SECTION_IDS)[number];

export type SetupCheckoffs = {
  checkedSectionIds: SetupSectionId[];
};

export const EMPTY_SETUP_CHECKOFFS: SetupCheckoffs = {
  checkedSectionIds: [],
};

const cacheByKey = new Map<string, SetupCheckoffs>();

export function setupCheckoffsStorageKey(
  challengeSlug: string,
  trainerId: string | null | undefined,
): string {
  const trainer = trainerId?.trim() || "anon";
  return `nuzlocke-setup-checkoffs:${challengeSlug}:${trainer}`;
}

function isSetupSectionId(value: string): value is SetupSectionId {
  return (SETUP_SECTION_IDS as readonly string[]).includes(value);
}

function normalize(raw: Partial<SetupCheckoffs> | null | undefined): SetupCheckoffs {
  const ids = Array.isArray(raw?.checkedSectionIds)
    ? raw.checkedSectionIds.filter(
        (id): id is SetupSectionId =>
          typeof id === "string" && isSetupSectionId(id),
      )
    : [];
  return { checkedSectionIds: [...new Set(ids)] };
}

function loadFromStorage(key: string): SetupCheckoffs {
  if (typeof window === "undefined") return EMPTY_SETUP_CHECKOFFS;
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return EMPTY_SETUP_CHECKOFFS;
    return normalize(JSON.parse(stored) as Partial<SetupCheckoffs>);
  } catch {
    return EMPTY_SETUP_CHECKOFFS;
  }
}

export function readSetupCheckoffs(key: string): SetupCheckoffs {
  if (typeof window === "undefined") return EMPTY_SETUP_CHECKOFFS;
  const cached = cacheByKey.get(key);
  if (cached) return cached;
  const loaded = loadFromStorage(key);
  cacheByKey.set(key, loaded);
  return loaded;
}

function notify(key: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SETUP_CHECKOFFS_CHANGE_EVENT, { detail: { key } }),
  );
}

export function writeSetupCheckoffs(
  key: string,
  next: SetupCheckoffs,
): SetupCheckoffs {
  const stable = normalize(next);
  cacheByKey.set(key, stable);
  if (typeof window !== "undefined") {
    try {
      if (stable.checkedSectionIds.length === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(stable));
      }
    } catch {
      // private mode / blocked storage
    }
  }
  notify(key);
  return stable;
}

export function setSetupSectionChecked(
  key: string,
  sectionId: SetupSectionId,
  checked: boolean,
): SetupCheckoffs {
  const current = readSetupCheckoffs(key);
  return writeSetupCheckoffs(key, {
    checkedSectionIds: withOrderedPrefixCheck(
      SETUP_SECTION_IDS,
      current.checkedSectionIds,
      sectionId,
      checked,
    ),
  });
}

export function isSetupSectionChecked(
  checkoffs: SetupCheckoffs,
  sectionId: SetupSectionId,
): boolean {
  return checkoffs.checkedSectionIds.includes(sectionId);
}

/** Subscribe for `useSyncExternalStore` (same-tab + cross-tab). */
export function subscribeSetupCheckoffs(
  key: string,
  onStoreChange: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ key?: string }>).detail;
    if (detail?.key && detail.key !== key) return;
    onStoreChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === null) {
      cacheByKey.clear();
      onStoreChange();
      return;
    }
    if (event.key !== key) return;
    cacheByKey.delete(key);
    onStoreChange();
  };
  window.addEventListener(SETUP_CHECKOFFS_CHANGE_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SETUP_CHECKOFFS_CHANGE_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

/** First incomplete checklist section, or null when all are done. */
export function nextSetupSection(
  checkoffs: SetupCheckoffs,
): SetupSectionId | null {
  for (const id of SETUP_SECTION_IDS) {
    if (!isSetupSectionChecked(checkoffs, id)) return id;
  }
  return null;
}
