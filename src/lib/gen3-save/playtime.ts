/**
 * Gen 3 wall-clock playtime from SaveBlock2 (hours / minutes / seconds /
 * vBlanks). Stored and compared as total whole seconds.
 */

import { MAX_PLAY_TIME_HOURS } from "./layout";

/** Soft max from pret MAX_PLAY_TIME + 59m 59s. */
export const MAX_PLAY_TIME_SECONDS =
  MAX_PLAY_TIME_HOURS * 3600 + 59 * 60 + 59;

export function playTimeToSeconds(
  hours: number,
  minutes: number,
  seconds: number,
): number {
  return (
    Math.trunc(hours) * 3600 + Math.trunc(minutes) * 60 + Math.trunc(seconds)
  );
}

export function splitPlayTimeSeconds(totalSeconds: number): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const clamped = Math.max(0, Math.trunc(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  return { hours, minutes, seconds };
}

/** Display helper — `12h 34m`, or `45m` when under an hour. */
export function formatPlayTime(totalSeconds: number): string {
  const { hours, minutes, seconds } = splitPlayTimeSeconds(totalSeconds);
  if (hours > 0) {
    return `${hours.toLocaleString("en-US")}h ${minutes}m`;
  }
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
