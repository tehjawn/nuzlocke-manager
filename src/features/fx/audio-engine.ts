/**
 * Thin HTMLAudio-based SFX player.
 * Missing files / autoplay blocks fail silently.
 */

import { SFX_SRC, type SfxId } from "@/features/fx/fx-events";
import { readFxPrefs } from "@/features/fx/fx-prefs";

const cache = new Map<string, HTMLAudioElement>();

function getAudio(src: string): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  const cached = cache.get(src);
  if (cached) return cached;

  const audio = new Audio(src);
  audio.preload = "auto";
  cache.set(src, audio);
  return audio;
}

/** Play a WAV/MP3 by public URL when prefs allow. */
export function playSfxSrc(src: string) {
  if (typeof window === "undefined") return;

  const prefs = readFxPrefs();
  if (!prefs.sfxEnabled) return;

  const audio = getAudio(src);
  if (!audio) return;

  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = prefs.volume;
    void audio.play()?.catch(() => {
      // Autoplay blocked or 404 — ignore.
    });
  } catch {
    // Ignore decode / play errors.
  }
}

/** Play a catalogued one-shot by id. */
export function playSfx(id: SfxId) {
  playSfxSrc(SFX_SRC[id]);
}
