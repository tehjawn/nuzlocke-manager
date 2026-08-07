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

/** Matches `w-[min(100vw-2rem,20rem)]` on the popover. */
const POPOVER_MAX_WIDTH = 320;
const POPOVER_GAP = 6;
const VIEWPORT_PAD = 8;
/** Quick-pick row only / with full picker — enough for flip-above. */
const POPOVER_HEIGHT_QUICK = 56;
const POPOVER_HEIGHT_FULL = 390;

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
    setPos(null);
  }

  function place() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(
      POPOVER_MAX_WIDTH,
      window.innerWidth - VIEWPORT_PAD * 2,
    );
    const left = Math.max(
      VIEWPORT_PAD,
      Math.min(rect.left, window.innerWidth - width - VIEWPORT_PAD),
    );

    const height = moreOpen ? POPOVER_HEIGHT_FULL : POPOVER_HEIGHT_QUICK;
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
    const spaceAbove = rect.top - VIEWPORT_PAD;
    const preferBelow =
      spaceBelow >= height + POPOVER_GAP || spaceBelow >= spaceAbove;
    const top = preferBelow
      ? rect.bottom + POPOVER_GAP
      : Math.max(VIEWPORT_PAD, rect.top - POPOVER_GAP - height);

    setPos((prev) =>
      prev && prev.top === top && prev.left === left ? prev : { top, left },
    );
  }

  if (disabled && open) {
    setOpen(false);
    setMoreOpen(false);
    setPos(null);
  }

  useLayoutEffect(() => {
    if (!open || disabled) return;
    place();
    // place() reads refs + moreOpen; open/moreOpen/disabled are the triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- place is stable enough via those deps
  }, [open, moreOpen, disabled]);

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
    function onReposition(event: Event) {
      // Picker list scroll is capture-phase on window — don't chase it.
      if (
        event.type === "scroll" &&
        event.target instanceof Node &&
        popoverRef.current?.contains(event.target)
      ) {
        return;
      }
      place();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- place/close close over latest moreOpen
  }, [open, moreOpen]);

  return (
    <div ref={rootRef}>
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
            if (open) close();
            else {
              setOpen(true);
              setMoreOpen(false);
            }
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

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              id={dialogId}
              role="dialog"
              aria-label="Pick status emoji"
              className="fixed z-[100] w-[min(100vw-2rem,20rem)] rounded-lg border border-frame bg-surface p-1.5 shadow-lg"
              style={{ top: pos.top, left: pos.left }}
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
              {moreOpen && (
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
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
