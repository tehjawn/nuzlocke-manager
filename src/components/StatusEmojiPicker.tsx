"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const POPOVER_WIDTH = 320;
const POPOVER_GAP = 6;
const VIEWPORT_PAD = 8;

type StatusEmojiPickerProps = {
  value: string | null;
  onChange: (emoji: string | null) => void;
  disabled?: boolean;
};

type PopoverPos = { top: number; left: number };

export function StatusEmojiPicker({
  value,
  onChange,
  disabled = false,
}: StatusEmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();

  function close() {
    setOpen(false);
    setMoreOpen(false);
  }

  function place() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_PAD * 2);
    let left = rect.left;
    left = Math.max(
      VIEWPORT_PAD,
      Math.min(left, window.innerWidth - width - VIEWPORT_PAD),
    );

    const popoverHeight = popoverRef.current?.offsetHeight ?? 0;
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
    const spaceAbove = rect.top - VIEWPORT_PAD;
    const preferBelow =
      popoverHeight === 0 ||
      spaceBelow >= popoverHeight + POPOVER_GAP ||
      spaceBelow >= spaceAbove;
    const top = preferBelow
      ? rect.bottom + POPOVER_GAP
      : Math.max(
          VIEWPORT_PAD,
          rect.top - POPOVER_GAP - (popoverHeight || 0),
        );

    setPos({ top, left });
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
  }, [open, moreOpen]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    function onReposition() {
      place();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    // Capture scrolls from overflow parents (profile editor panel, etc.).
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <span className="mb-1 block font-bold text-muted">Status emoji</span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          ref={triggerRef}
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

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              id={dialogId}
              role="dialog"
              aria-label="Pick status emoji"
              className="fixed z-[120] w-[min(100vw-2rem,20rem)] rounded-lg border border-frame bg-surface p-1.5 shadow-lg"
              style={
                pos
                  ? { top: pos.top, left: pos.left }
                  : { top: -9999, left: -9999, visibility: "hidden" }
              }
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
                      close();
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
                      close();
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
