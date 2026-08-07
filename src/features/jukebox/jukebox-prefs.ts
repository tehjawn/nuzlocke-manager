/**
 * Client-side jukebox preferences (#341).
 * localStorage + custom event + useSyncExternalStore (same idea as fx-prefs).
 */

import { clampTrackIndex } from "@/features/jukebox/playlist";

export const JUKEBOX_PREFS_STORAGE_KEY = "nuzlocke-jukebox-prefs";
export const JUKEBOX_PREFS_CHANGE_EVENT = "nuzlocke-jukebox-prefs-change";

export type JukeboxPrefs = {
  /** Index into `JUKEBOX_PLAYLIST`. */
  trackIndex: number;
  /** 0–1 playback volume. */
  volume: number;
  /**
   * Last play intent. Restored on reload only after a user gesture on this
   * visit when the browser blocks autoplay — we never unmuted-autoplay.
   */
  wantPlaying: boolean;
};

export const DEFAULT_JUKEBOX_PREFS: JukeboxPrefs = {
  trackIndex: 0,
  volume: 0.4,
  wantPlaying: false,
};

/** Cached client snapshot — must stay referentially stable between changes. */
let cachedPrefs: JukeboxPrefs | null = null;

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_JUKEBOX_PREFS.volume;
  return Math.min(1, Math.max(0, value));
}

function normalizePrefs(
  raw: Partial<JukeboxPrefs> | null | undefined,
): JukeboxPrefs {
  return {
    trackIndex: clampTrackIndex(
      typeof raw?.trackIndex === "number"
        ? raw.trackIndex
        : DEFAULT_JUKEBOX_PREFS.trackIndex,
    ),
    volume: clampVolume(raw?.volume ?? DEFAULT_JUKEBOX_PREFS.volume),
    wantPlaying:
      typeof raw?.wantPlaying === "boolean"
        ? raw.wantPlaying
        : DEFAULT_JUKEBOX_PREFS.wantPlaying,
  };
}

function prefsEqual(a: JukeboxPrefs, b: JukeboxPrefs): boolean {
  return (
    a.trackIndex === b.trackIndex &&
    a.volume === b.volume &&
    a.wantPlaying === b.wantPlaying
  );
}

function stabilize(prefs: JukeboxPrefs): JukeboxPrefs {
  return prefsEqual(prefs, DEFAULT_JUKEBOX_PREFS)
    ? DEFAULT_JUKEBOX_PREFS
    : prefs;
}

function loadPrefsFromStorage(): JukeboxPrefs {
  try {
    const stored = localStorage.getItem(JUKEBOX_PREFS_STORAGE_KEY);
    if (!stored) return DEFAULT_JUKEBOX_PREFS;
    return stabilize(
      normalizePrefs(JSON.parse(stored) as Partial<JukeboxPrefs>),
    );
  } catch {
    return DEFAULT_JUKEBOX_PREFS;
  }
}

export function readJukeboxPrefs(): JukeboxPrefs {
  if (typeof window === "undefined") return DEFAULT_JUKEBOX_PREFS;
  if (cachedPrefs) return cachedPrefs;
  cachedPrefs = loadPrefsFromStorage();
  return cachedPrefs;
}

function notifyJukeboxPrefsListeners() {
  window.dispatchEvent(new Event(JUKEBOX_PREFS_CHANGE_EVENT));
}

export function writeJukeboxPrefs(next: JukeboxPrefs) {
  const stable = stabilize(normalizePrefs(next));
  if (cachedPrefs && prefsEqual(cachedPrefs, stable)) {
    return cachedPrefs;
  }
  cachedPrefs = stable;
  try {
    localStorage.setItem(JUKEBOX_PREFS_STORAGE_KEY, JSON.stringify(stable));
  } catch {
    // private mode / blocked storage
  }
  notifyJukeboxPrefsListeners();
  return stable;
}

export function patchJukeboxPrefs(patch: Partial<JukeboxPrefs>): JukeboxPrefs {
  return writeJukeboxPrefs({ ...readJukeboxPrefs(), ...patch });
}

/** Subscribe for `useSyncExternalStore` (same-tab + cross-tab). */
export function subscribeJukeboxPrefs(onStoreChange: () => void): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key !== JUKEBOX_PREFS_STORAGE_KEY && event.key !== null) return;
    cachedPrefs = loadPrefsFromStorage();
    onStoreChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(JUKEBOX_PREFS_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(JUKEBOX_PREFS_CHANGE_EVENT, onStoreChange);
  };
}
