"use client";

import { useEffect, useId, useRef, useState } from "react";
import EmojiPicker, {
  EmojiStyle,
  Theme,
  type EmojiClickData,
} from "emoji-picker-react";

const QUICK_STATUS_EMOJIS = [
  "🔥",
  "💀",
  "🏆",
  "👑",
  "💪",
  "🫡",
  "😭",
  "😤",
  "✨",
  "🌱",
] as const;

type StatusEmojiPickerProps = {
  value: string | null;
  onChange: (emoji: string | null) => void;
  disabled?: boolean;
};

export function StatusEmojiPicker({
  value,
  onChange,
  disabled = false,
}: StatusEmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setMoreOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <span className="mb-1 block font-bold text-muted">Status emoji</span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-label={value ? "Change status emoji" : "Pick status emoji"}
          aria-expanded={open}
          aria-controls={dialogId}
          className="pressable inline-flex h-11 min-w-11 items-center justify-center rounded-lg border border-frame bg-surface px-2 text-xl leading-none disabled:opacity-60"
          onClick={() => {
            setOpen((v) => !v);
            setMoreOpen(false);
          }}
        >
          {value ?? "＋"}
        </button>
        {value ? (
          <button
            type="button"
            disabled={disabled}
            className="pressable rounded-lg border border-frame bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-muted disabled:opacity-60"
            onClick={() => onChange(null)}
          >
            Clear
          </button>
        ) : (
          <span className="text-xs text-muted">Optional vibe for your run</span>
        )}
      </div>

      {open ? (
        <div
          id={dialogId}
          role="dialog"
          aria-label="Pick status emoji"
          className="absolute left-0 z-30 mt-1 w-[min(100vw-2rem,20rem)] rounded-lg border border-frame bg-surface p-1.5 shadow-lg"
        >
          <div className="flex flex-wrap items-center gap-0.5">
            {QUICK_STATUS_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                disabled={disabled}
                title={emoji}
                className={`rounded-lg px-1.5 py-1 text-base leading-none hover:bg-accent/15 ${
                  value === emoji ? "bg-accent/20" : ""
                }`}
                onClick={() => {
                  onChange(emoji);
                  setOpen(false);
                  setMoreOpen(false);
                }}
              >
                <span aria-hidden>{emoji}</span>
              </button>
            ))}
            <button
              type="button"
              disabled={disabled}
              aria-label="More emojis"
              aria-expanded={moreOpen}
              title="More emojis"
              className={`ml-0.5 shrink-0 rounded-lg border border-frame/40 px-2 py-1 font-display text-sm font-bold leading-none hover:bg-accent/15 ${
                moreOpen
                  ? "border-accent bg-accent/20 text-accent-deep"
                  : "bg-surface-2 text-muted"
              }`}
              onClick={() => setMoreOpen((v) => !v)}
            >
              +
            </button>
          </div>
          {moreOpen ? (
            <div className="emoji-picker-shell mt-1.5 overflow-hidden rounded-lg border border-frame/30">
              <EmojiPicker
                onEmojiClick={(data: EmojiClickData) => {
                  onChange(data.emoji);
                  setOpen(false);
                  setMoreOpen(false);
                }}
                theme={Theme.AUTO}
                emojiStyle={EmojiStyle.NATIVE}
                width="100%"
                height={320}
                searchPlaceHolder="Search emoji…"
                previewConfig={{ showPreview: false }}
                skinTonesDisabled
                lazyLoadEmojis
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
