/**
 * Shared HTMLAudio element for SeasonJukebox UIs (#341).
 * One engine so desktop rail + mobile Info can both mount without dual playback.
 */

import { clampTrackIndex, JUKEBOX_PLAYLIST } from "@/features/jukebox/playlist";
import {
  patchJukeboxPrefs,
  readJukeboxPrefs,
} from "@/features/jukebox/jukebox-prefs";

type Listener = () => void;

let audio: HTMLAudioElement | null = null;
let playing = false;
/** 0–1 playback progress through the current track. */
let progress = 0;
let resumeAfterSrc = false;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

function readProgress(el: HTMLAudioElement): number {
  const { currentTime, duration } = el;
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  if (!Number.isFinite(currentTime) || currentTime <= 0) return 0;
  return Math.min(1, Math.max(0, currentTime / duration));
}

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (audio) return audio;

  const el = new Audio();
  el.preload = "metadata";
  el.volume = readJukeboxPrefs().volume;

  el.addEventListener("ended", () => {
    progress = 0;
    notify();
    const next = clampTrackIndex(readJukeboxPrefs().trackIndex + 1);
    resumeAfterSrc = true;
    patchJukeboxPrefs({ trackIndex: next, wantPlaying: true });
    loadCurrentTrack();
  });
  el.addEventListener("play", () => {
    playing = true;
    notify();
  });
  el.addEventListener("pause", () => {
    playing = false;
    progress = readProgress(el);
    notify();
  });
  el.addEventListener("timeupdate", () => {
    const next = readProgress(el);
    // Skip tiny updates to cut re-renders (timeupdate fires often).
    if (Math.abs(next - progress) < 0.002 && next < 0.998) return;
    progress = next;
    notify();
  });
  el.addEventListener("loadedmetadata", () => {
    progress = readProgress(el);
    notify();
  });
  el.addEventListener("emptied", () => {
    progress = 0;
    notify();
  });

  audio = el;
  const initial = readJukeboxPrefs();
  el.src = JUKEBOX_PLAYLIST[clampTrackIndex(initial.trackIndex)]!.src;
  el.load();
  return el;
}

function loadCurrentTrack() {
  const el = ensureAudio();
  if (!el) return;
  const src =
    JUKEBOX_PLAYLIST[clampTrackIndex(readJukeboxPrefs().trackIndex)]!.src;
  const resume = resumeAfterSrc || !el.paused;
  resumeAfterSrc = false;
  if (el.getAttribute("src") === src) {
    if (resume && el.paused) {
      void el.play()?.catch(() => {
        playing = false;
        patchJukeboxPrefs({ wantPlaying: false });
        notify();
      });
    }
    return;
  }
  progress = 0;
  notify();
  el.src = src;
  el.load();
  if (resume) {
    void el.play()?.catch(() => {
      playing = false;
      patchJukeboxPrefs({ wantPlaying: false });
      notify();
    });
  }
}

export function subscribeJukeboxEngine(onStoreChange: Listener): () => void {
  ensureAudio();
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getJukeboxPlaying(): boolean {
  return playing;
}

export function getJukeboxPlayingServer(): boolean {
  return false;
}

export function getJukeboxProgress(): number {
  return progress;
}

export function getJukeboxProgressServer(): number {
  return 0;
}

export function setJukeboxVolume(volume: number) {
  const el = ensureAudio();
  if (el) el.volume = volume;
}

export function syncJukeboxTrackFromPrefs() {
  loadCurrentTrack();
}

export function toggleJukeboxPlay() {
  const el = ensureAudio();
  if (!el) return;
  if (!el.paused) {
    el.pause();
    patchJukeboxPrefs({ wantPlaying: false });
    return;
  }
  void el.play()?.then(
    () => patchJukeboxPrefs({ wantPlaying: true }),
    () => {
      playing = false;
      patchJukeboxPrefs({ wantPlaying: false });
      notify();
    },
  );
}

export function skipJukeboxTrack(delta: number) {
  const el = ensureAudio();
  if (el && !el.paused) resumeAfterSrc = true;
  patchJukeboxPrefs({
    trackIndex: clampTrackIndex(readJukeboxPrefs().trackIndex + delta),
  });
  loadCurrentTrack();
}
