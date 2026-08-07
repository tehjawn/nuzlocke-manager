"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  trainingTierFill,
  trainingTierLabel,
  trainingTierTip,
  trainingTierToneClass,
  type TrainingTier,
} from "@/lib/training-quality";

type BondHeartProps = {
  tier: TrainingTier;
  className?: string;
};

type TipPos = { top: number; centerX: number; above: boolean };

/**
 * Outline heart that fills from the bottom as training / bond progresses.
 * Tint from `.pokemon-bond-heart--*`; hover shows a training-level tip
 * (portaled so `.gba-frame` overflow does not clip it). Safe inside parent
 * buttons — trigger is a span, not a nested button.
 */
export function BondHeart({ tier, className = "h-3.5 w-3.5" }: BondHeartProps) {
  const tip = trainingTierTip(tier);
  const label = trainingTierLabel(tier) ?? "Strangers";
  const tipId = useId();
  const gradientId = `bond-ultra-${useId().replace(/:/g, "")}`;
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<TipPos | null>(null);
  const isUltra = tier === "ultra";

  const place = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const maxWidth = Math.min(240, window.innerWidth - margin * 2);
    let centerX = rect.left + rect.width / 2;
    centerX = Math.max(
      margin + maxWidth / 2,
      Math.min(centerX, window.innerWidth - margin - maxWidth / 2),
    );
    const above = rect.top > 120;
    const top = above ? rect.top - 8 : rect.bottom + 8;
    setPos({ top, centerX, above });
  }, []);

  const show = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

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

  const fill = trainingTierFill(tier);
  const style = { "--bond-fill": `${fill * 100}%` } as CSSProperties;
  const paint = isUltra ? `url(#${gradientId})` : undefined;

  return (
    <span
      ref={wrapRef}
      aria-describedby={open ? tipId : undefined}
      aria-label={label}
      role="img"
      className={`pokemon-bond-heart pokemon-bond-heart--${tier} ${className}`}
      style={style}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <svg
        aria-hidden
        className="pokemon-bond-heart__svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        {isUltra && (
          <defs>
            <linearGradient
              id={gradientId}
              x1="2"
              y1="4"
              x2="22"
              y2="20"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#ff7a7a" />
              <stop offset="28%" stopColor="#ffb84a" />
              <stop offset="52%" stopColor="#6ad4a0" />
              <stop offset="74%" stopColor="#6ab8ef" />
              <stop offset="100%" stopColor="#c48ad4" />
            </linearGradient>
          </defs>
        )}
        <path
          className="pokemon-bond-heart__outline"
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          strokeLinejoin="round"
          style={paint ? { stroke: paint } : undefined}
        />
        <path
          className="pokemon-bond-heart__fill"
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          style={paint ? { fill: paint } : undefined}
        />
      </svg>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <span
              id={tipId}
              role="tooltip"
              className={`info-speech-bubble pointer-events-none fixed z-210 max-w-60 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-ink ${
                pos.above
                  ? "info-speech-bubble--above"
                  : "info-speech-bubble--below"
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
              {tip}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

/**
 * Heart + bond label for details / hover.
 * - `inline` — icon left of text
 * - `chip` — bordered row for the details modal
 * - `tile` — icon over text for the hover grade strip
 */
export function TrainingTierCaption({
  tier,
  variant = "inline",
  className = "",
  iconClassName,
}: {
  tier: TrainingTier;
  variant?: "inline" | "chip" | "tile";
  className?: string;
  iconClassName?: string;
}) {
  const label = trainingTierLabel(tier);
  if (!label) return null;

  const tone = trainingTierToneClass(tier);
  const iconSize =
    iconClassName ??
    (variant === "tile" ? "h-4 w-4 shrink-0" : "h-3.5 w-3.5 shrink-0");

  const icon = <BondHeart className={iconSize} tier={tier} />;
  const text = (
    <span
      className={`min-w-0 ${
        variant === "tile"
          ? "text-center text-[10px] font-semibold leading-tight tracking-tight"
          : "truncate text-[11px] font-semibold tracking-tight"
      } ${tone}`}
    >
      {label}
    </span>
  );

  if (variant === "tile") {
    return (
      <div
        className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md border border-frame/45 bg-surface-2/90 px-1 py-1.5 ${className}`}
        title={label}
      >
        {icon}
        {text}
      </div>
    );
  }

  if (variant === "chip") {
    return (
      <p
        className={`inline-flex w-full max-w-full items-center gap-1.5 rounded-md border border-frame/45 bg-surface-2/90 px-2 py-1.5 ${className}`}
        title={label}
      >
        {icon}
        {text}
      </p>
    );
  }

  return (
    <p
      className={`inline-flex max-w-full items-center justify-center gap-1 sm:justify-start ${className}`}
      title={label}
    >
      {icon}
      {text}
    </p>
  );
}
