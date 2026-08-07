"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Frame } from "@/components/Frame";
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
  "pressable inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-frame/60 bg-surface text-ink hover:border-interactive/50 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Compact left-rail / mobile-Info music player (#341).
 * Default paused — never unmuted-autoplay on first visit.
 */
export function SeasonJukebox() {
  const prefs = useSyncExternalStore(
    subscribeJukeboxPrefs,
    readJukeboxPrefs,
    () => DEFAULT_JUKEBOX_PREFS,
  );
  const [playing, setPlaying] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Set before a trackIndex change that should continue playback (skip / ended). */
  const resumeAfterSrcRef = useRef(false);
  const track = JUKEBOX_PLAYLIST[clampTrackIndex(prefs.trackIndex)]!;

  const applyVolume = useEffectEvent((volume: number) => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  });

  const loadTrack = useEffectEvent((src: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    const resume = resumeAfterSrcRef.current || !audio.paused;
    resumeAfterSrcRef.current = false;
    if (audio.getAttribute("src") === src) {
      if (resume && audio.paused) {
        void audio.play()?.catch(() => {
          setPlaying(false);
          patchJukeboxPrefs({ wantPlaying: false });
        });
      }
      return;
    }
    audio.src = src;
    audio.load();
    if (resume) {
      void audio.play()?.catch(() => {
        setPlaying(false);
        patchJukeboxPrefs({ wantPlaying: false });
      });
    }
  });

  // Mount audio once. Never autoplay from stored wantPlaying.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = readJukeboxPrefs().volume;
    audioRef.current = audio;

    const onEnded = () => {
      const next = clampTrackIndex(readJukeboxPrefs().trackIndex + 1);
      resumeAfterSrcRef.current = true;
      patchJukeboxPrefs({ trackIndex: next, wantPlaying: true });
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    const initial = readJukeboxPrefs();
    audio.src = JUKEBOX_PLAYLIST[clampTrackIndex(initial.trackIndex)]!.src;
    audio.load();

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.pause();
      audio.removeAttribute("src");
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    applyVolume(prefs.volume);
  }, [prefs.volume, applyVolume]);

  useEffect(() => {
    loadTrack(track.src);
  }, [track.src, loadTrack]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      patchJukeboxPrefs({ wantPlaying: false });
      return;
    }
    void audio.play()?.then(
      () => patchJukeboxPrefs({ wantPlaying: true }),
      () => {
        setPlaying(false);
        patchJukeboxPrefs({ wantPlaying: false });
      },
    );
  }

  function skip(delta: number) {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      resumeAfterSrcRef.current = true;
    }
    patchJukeboxPrefs({
      trackIndex: clampTrackIndex(prefs.trackIndex + delta),
    });
  }

  return (
    <Frame title="Jukebox" dense>
      <div className="space-y-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-snug tracking-tight">
            {track.title}
          </p>
          <p className="truncate text-xs text-muted">{track.artist}</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={btnClass}
            aria-label="Previous track"
            onClick={() => skip(-1)}
          >
            <PrevIcon />
          </button>
          <button
            type="button"
            className={btnClass}
            aria-label={playing ? "Pause" : "Play"}
            onClick={togglePlay}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            className={btnClass}
            aria-label="Next track"
            onClick={() => skip(1)}
          >
            <NextIcon />
          </button>
          <label className="ml-1 flex min-w-0 flex-1 items-center gap-1.5">
            <span className="sr-only">Volume</span>
            <VolumeIcon />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={prefs.volume}
              onChange={(e) =>
                patchJukeboxPrefs({ volume: Number(e.target.value) })
              }
              className="h-1.5 w-full min-w-0 accent-[var(--interactive)]"
            />
          </label>
        </div>

        <div>
          <button
            type="button"
            className="text-[11px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
            aria-expanded={creditsOpen}
            onClick={() => setCreditsOpen((o) => !o)}
          >
            ♪ Credits
          </button>
          {creditsOpen ? <CreditsList prefs={prefs} /> : null}
        </div>
      </div>
    </Frame>
  );
}

function CreditsList({ prefs }: { prefs: JukeboxPrefs }) {
  return (
    <ul className="mt-1.5 space-y-1.5 text-[11px] leading-snug text-muted">
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
            {t.license}
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
      className="h-3.5 w-3.5"
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
      className="h-3.5 w-3.5"
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
      className="h-3.5 w-3.5"
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
      className="h-3.5 w-3.5"
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
      className="h-3.5 w-3.5 shrink-0 text-muted"
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
