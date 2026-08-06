"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type InfoTipProps = {
  /** Visible chip / label content. */
  children: ReactNode;
  /** Speech-bubble body. Tip is skipped when empty. */
  tip: string;
  /**
   * When true, render a non-button trigger (safe inside a parent <button> /
   * role="button" card). Hover still works; keyboard focus may ride the parent.
   */
  embedded?: boolean;
  className?: string;
  chipClassName?: string;
};

type TipPos = { top: number; centerX: number; above: boolean };

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 shrink-0 text-muted/70"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" strokeLinecap="round" />
      <path d="M12 7.75v.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Dotted-underline value with info icon and a portaled speech-bubble tip.
 * Portal avoids clipping inside `.gba-frame { overflow: hidden }`, and the tip
 * sits above every overlay layer (modals z-100, dialogs z-110, palette z-200).
 */
export function InfoTip({
  children,
  tip,
  embedded = false,
  className = "",
  chipClassName = "",
}: InfoTipProps) {
  const tipId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<TipPos | null>(null);
  const text = tip.trim();

  const place = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const maxWidth = Math.min(240, window.innerWidth - margin * 2);
    let centerX = rect.left + rect.width / 2;
    // Keep the bubble’s horizontal center on-screen for a full-width tip.
    centerX = Math.max(
      margin + maxWidth / 2,
      Math.min(centerX, window.innerWidth - margin - maxWidth / 2),
    );
    const above = rect.top > 120;
    const top = above ? rect.top - 8 : rect.bottom + 8;
    setPos({ top, centerX, above });
  }, []);

  const show = useCallback(() => {
    if (!text) return;
    place();
    setOpen(true);
  }, [place, text]);

  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onScroll() {
      setOpen(false);
    }
    function onResize() {
      place();
    }
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, place]);

  if (!text) {
    // Still apply chip chrome for unknown / free-typed values (no tip yet).
    const emptyClass = [chipClassName, className].filter(Boolean).join(" ");
    return <span className={emptyClass || undefined}>{children}</span>;
  }

  const triggerClass = `inline-flex max-w-full items-center gap-1 text-left ${chipClassName}`;

  const trigger = embedded ? (
    <span className={triggerClass} aria-describedby={open ? tipId : undefined}>
      <span className="truncate underline decoration-dotted decoration-muted/65 underline-offset-[3px]">
        {children}
      </span>
      <InfoIcon />
    </span>
  ) : (
    <button
      type="button"
      className={triggerClass}
      aria-describedby={open ? tipId : undefined}
      onFocus={show}
      onBlur={hide}
    >
      <span className="truncate underline decoration-dotted decoration-muted/65 underline-offset-[3px]">
        {children}
      </span>
      <InfoIcon />
    </button>
  );

  return (
    <span
      ref={wrapRef}
      className={`group/infotip relative inline-flex max-w-full items-center ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {trigger}
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <span
              id={tipId}
              role="tooltip"
              className={`info-speech-bubble pointer-events-none fixed z-210 max-w-60 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-ink ${
                pos.above ? "info-speech-bubble--above" : "info-speech-bubble--below"
              }`}
              style={{
                top: pos.top,
                left: pos.centerX,
                maxWidth: Math.min(
                  240,
                  typeof window !== "undefined" ? window.innerWidth - 16 : 240,
                ),
                transform: pos.above
                  ? "translate(-50%, -100%)"
                  : "translateX(-50%)",
              }}
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
