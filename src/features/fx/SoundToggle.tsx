"use client";

import { useSyncExternalStore } from "react";
import {
  isSfxMuted,
  patchFxPrefs,
  readFxPrefs,
  subscribeFxPrefs,
} from "@/features/fx/fx-prefs";

function getMutedSnapshot(): boolean {
  return isSfxMuted(readFxPrefs());
}

function getServerMutedSnapshot(): boolean {
  return false;
}

/** Footer control: mute / unmute SFX. */
export function SoundToggle() {
  const muted = useSyncExternalStore(
    subscribeFxPrefs,
    getMutedSnapshot,
    getServerMutedSnapshot,
  );

  return (
    <button
      type="button"
      onClick={() => patchFxPrefs({ sfxEnabled: muted })}
      aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
      title={muted ? "Unmute SFX" : "Mute SFX"}
      aria-pressed={!muted}
      className="pressable inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-frame bg-surface text-ink hover:border-interactive/50"
    >
      {muted ? <SpeakerOffIcon /> : <SpeakerIcon />}
    </button>
  );
}

function SpeakerIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M3.5 8.2v3.6h2.4L9.5 15V5L5.9 8.2H3.5z"
        strokeLinejoin="round"
      />
      <path d="M12.2 7.2a3.2 3.2 0 010 5.6" strokeLinecap="round" />
      <path d="M14.2 5.4a5.6 5.6 0 010 9.2" strokeLinecap="round" />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M3.5 8.2v3.6h2.4L9.5 15V5L5.9 8.2H3.5z"
        strokeLinejoin="round"
      />
      <path d="M13 7.5l4 5M17 7.5l-4 5" strokeLinecap="round" />
    </svg>
  );
}
