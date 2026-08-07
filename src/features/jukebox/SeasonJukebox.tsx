"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getJukeboxPlaying,
  getJukeboxPlayingServer,
  getJukeboxProgress,
  getJukeboxProgressServer,
  setJukeboxVolume,
  skipJukeboxTrack,
  subscribeJukeboxEngine,
  syncJukeboxTrackFromPrefs,
  toggleJukeboxPlay,
} from "@/features/jukebox/jukebox-engine";
import {
  DEFAULT_JUKEBOX_PREFS,
  patchJukeboxPrefs,
  readJukeboxPrefs,
  subscribeJukeboxPrefs,
  type JukeboxPrefs,
} from "@/features/jukebox/jukebox-prefs";
import {
  clampTrackIndex,
  JUKEBOX_PLAYLIST,
} from "@/features/jukebox/playlist";

const btnClass =
  "pressable inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-frame/50 bg-surface text-ink hover:border-interactive/50";

/**
 * Condensed left-rail music player (#341).
 * Default paused — never unmuted-autoplay on first visit.
 */
export function SeasonJukebox() {
  const prefs = useSyncExternalStore(
    subscribeJukeboxPrefs,
    readJukeboxPrefs,
    () => DEFAULT_JUKEBOX_PREFS,
  );
  const playing = useSyncExternalStore(
    subscribeJukeboxEngine,
    getJukeboxPlaying,
    getJukeboxPlayingServer,
  );
  const progress = useSyncExternalStore(
    subscribeJukeboxEngine,
    getJukeboxProgress,
    getJukeboxProgressServer,
  );
  const [creditsOpen, setCreditsOpen] = useState(false);
  const track = JUKEBOX_PLAYLIST[clampTrackIndex(prefs.trackIndex)]!;

  useEffect(() => {
    setJukeboxVolume(prefs.volume);
  }, [prefs.volume]);

  useEffect(() => {
    syncJukeboxTrackFromPrefs();
  }, [prefs.trackIndex]);

  return (
    <section
      aria-label="Jukebox"
      className="relative rounded-[var(--radius)] border border-frame/50 bg-surface-2/50 px-2 py-1.5 pb-2"
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={btnClass}
          aria-label="Previous track"
          onClick={() => skipJukeboxTrack(-1)}
        >
          <PrevIcon />
        </button>
        <button
          type="button"
          className={btnClass}
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => toggleJukeboxPlay()}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          className={btnClass}
          aria-label="Next track"
          onClick={() => skipJukeboxTrack(1)}
        >
          <NextIcon />
        </button>

        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-semibold tracking-tight">
            {track.title}
          </p>
          <p className="truncate text-[10px] text-muted">
            {track.artist}
            {" · "}
            <button
              type="button"
              className="font-semibold underline-offset-2 hover:underline"
              aria-expanded={creditsOpen}
              onClick={() => setCreditsOpen((o) => !o)}
            >
              ♪
            </button>
          </p>
        </div>

        <VolumeControl
          volume={prefs.volume}
          onVolumeChange={(volume) => patchJukeboxPrefs({ volume })}
        />
      </div>

      {creditsOpen ? <CreditsList prefs={prefs} /> : null}

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-[calc(var(--radius)-1px)] bg-frame/35"
        aria-hidden
      >
        <div
          className="h-full bg-accent transition-[width] duration-150 ease-linear"
          style={{ width: `${Math.round(progress * 1000) / 10}%` }}
        />
      </div>
      <span className="sr-only">
        Track progress: {Math.round(progress * 100)}%
      </span>
    </section>
  );
}

function VolumeControl({
  volume,
  onVolumeChange,
}: {
  volume: number;
  onVolumeChange: (volume: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sliderId = useId();
  const muted = volume <= 0.001;

  const close = useEffectEvent(() => setOpen(false));

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node)) return;
      if (!root.contains(event.target)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className={btnClass}
        aria-label={open ? "Hide volume" : "Show volume"}
        aria-expanded={open}
        aria-controls={sliderId}
        onClick={() => setOpen((v) => !v)}
      >
        {muted ? <VolumeMutedIcon /> : <VolumeIcon />}
      </button>
      {open ? (
        <div
          id={sliderId}
          role="dialog"
          aria-label="Volume"
          className="absolute bottom-full right-0 z-20 mb-1.5 flex h-28 w-9 flex-col items-center justify-center rounded-md border border-frame/60 bg-surface px-1.5 py-2 shadow-md"
        >
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(volume * 100)}
            aria-valuetext={`${Math.round(volume * 100)}%`}
            className="h-24 w-4 cursor-pointer appearance-auto accent-[var(--accent)] [writing-mode:vertical-lr] [direction:rtl]"
          />
        </div>
      ) : null}
    </div>
  );
}

function CreditsList({ prefs }: { prefs: JukeboxPrefs }) {
  return (
    <ul className="mt-1.5 space-y-1 border-t border-frame/40 pt-1.5 text-[10px] leading-snug text-muted">
      {JUKEBOX_PLAYLIST.map((t, i) => (
        <li
          key={t.id}
          className={i === prefs.trackIndex ? "text-ink" : undefined}
        >
          <span className="font-semibold">{t.title}</span>
          {" · "}
          {t.artist}
          {" · "}
          <a
            href={t.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            Gimi
          </a>
          {" · "}
          <a
            href={t.licenseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            license
          </a>
        </li>
      ))}
    </ul>
  );
}

function PlayIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-3 w-3"
      fill="currentColor"
    >
      <path d="M6.5 4.5v11l9-5.5-9-5.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-3 w-3"
      fill="currentColor"
    >
      <rect x="5.5" y="4.5" width="3" height="11" rx="0.5" />
      <rect x="11.5" y="4.5" width="3" height="11" rx="0.5" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-3 w-3"
      fill="currentColor"
    >
      <path d="M14.5 4.5v11l-7.5-5.5 7.5-5.5z" />
      <rect x="4.5" y="4.5" width="1.75" height="11" rx="0.4" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-3 w-3"
      fill="currentColor"
    >
      <path d="M5.5 4.5v11l7.5-5.5-7.5-5.5z" />
      <rect x="13.75" y="4.5" width="1.75" height="11" rx="0.4" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M3.5 8.2v3.6h2.4L9.5 15V5L5.9 8.2H3.5z"
        strokeLinejoin="round"
      />
      <path d="M12.2 7.2a3.2 3.2 0 010 5.6" strokeLinecap="round" />
    </svg>
  );
}

function VolumeMutedIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M3.5 8.2v3.6h2.4L9.5 15V5L5.9 8.2H3.5z"
        strokeLinejoin="round"
      />
      <path d="M12.5 8l4 4M16.5 8l-4 4" strokeLinecap="round" />
    </svg>
  );
}
