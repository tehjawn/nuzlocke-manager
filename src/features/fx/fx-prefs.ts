/**
 * Client-side SFX / celebration preferences.
 * localStorage + custom event + useSyncExternalStore (same idea as theme).
 */

export const FX_PREFS_STORAGE_KEY = "nuzlocke-fx-prefs";
export const FX_PREFS_CHANGE_EVENT = "nuzlocke-fx-prefs-change";

export type FxPrefs = {
  /** One-shot sound effects on game events. */
  sfxEnabled: boolean;
  /** Animated celebration overlays. */
  celebrationsEnabled: boolean;
  /** 0–1 master volume for SFX. */
  volume: number;
};

export const DEFAULT_FX_PREFS: FxPrefs = {
  sfxEnabled: true,
  celebrationsEnabled: true,
  volume: 0.78,
};

/** Cached client snapshot — must stay referentially stable between changes. */
let cachedPrefs: FxPrefs | null = null;

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FX_PREFS.volume;
  return Math.min(1, Math.max(0, value));
}

function normalizePrefs(raw: Partial<FxPrefs> | null | undefined): FxPrefs {
  return {
    sfxEnabled:
      typeof raw?.sfxEnabled === "boolean"
        ? raw.sfxEnabled
        : DEFAULT_FX_PREFS.sfxEnabled,
    celebrationsEnabled:
      typeof raw?.celebrationsEnabled === "boolean"
        ? raw.celebrationsEnabled
        : DEFAULT_FX_PREFS.celebrationsEnabled,
    volume: clampVolume(raw?.volume ?? DEFAULT_FX_PREFS.volume),
  };
}

function prefsEqual(a: FxPrefs, b: FxPrefs): boolean {
  return (
    a.sfxEnabled === b.sfxEnabled &&
    a.celebrationsEnabled === b.celebrationsEnabled &&
    a.volume === b.volume
  );
}

function stabilize(prefs: FxPrefs): FxPrefs {
  return prefsEqual(prefs, DEFAULT_FX_PREFS) ? DEFAULT_FX_PREFS : prefs;
}

function loadPrefsFromStorage(): FxPrefs {
  try {
    const stored = localStorage.getItem(FX_PREFS_STORAGE_KEY);
    if (!stored) return DEFAULT_FX_PREFS;
    return stabilize(normalizePrefs(JSON.parse(stored) as Partial<FxPrefs>));
  } catch {
    return DEFAULT_FX_PREFS;
  }
}

export function readFxPrefs(): FxPrefs {
  if (typeof window === "undefined") return DEFAULT_FX_PREFS;
  if (cachedPrefs) return cachedPrefs;
  cachedPrefs = loadPrefsFromStorage();
  return cachedPrefs;
}

function notifyFxPrefsListeners() {
  window.dispatchEvent(new Event(FX_PREFS_CHANGE_EVENT));
}

export function writeFxPrefs(next: FxPrefs) {
  const stable = stabilize(normalizePrefs(next));
  if (cachedPrefs && prefsEqual(cachedPrefs, stable)) {
    return cachedPrefs;
  }
  cachedPrefs = stable;
  try {
    localStorage.setItem(FX_PREFS_STORAGE_KEY, JSON.stringify(stable));
  } catch {
    // private mode / blocked storage
  }
  notifyFxPrefsListeners();
  return stable;
}

export function patchFxPrefs(patch: Partial<FxPrefs>): FxPrefs {
  return writeFxPrefs({ ...readFxPrefs(), ...patch });
}

export function isSfxMuted(prefs: FxPrefs = readFxPrefs()): boolean {
  return !prefs.sfxEnabled;
}

/** Subscribe for `useSyncExternalStore` (same-tab + cross-tab). */
export function subscribeFxPrefs(onStoreChange: () => void): () => void {
  function onStorage(event: StorageEvent) {
    // `key === null` means localStorage.clear() in another tab.
    if (event.key !== FX_PREFS_STORAGE_KEY && event.key !== null) return;
    cachedPrefs = loadPrefsFromStorage();
    onStoreChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(FX_PREFS_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(FX_PREFS_CHANGE_EVENT, onStoreChange);
  };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
