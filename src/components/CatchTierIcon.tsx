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
import {
  catchTierLabel,
  catchTierTip,
  catchTierToneClass,
  type CatchTier,
} from "@/lib/iv-quality";

type IconProps = { className?: string; gradientId?: string };

type TipPos = { top: number; centerX: number; above: boolean };

const iconBase = {
  viewBox: "0 0 24 24",
  "aria-hidden": true,
} as const;

/** Dotted circle — big oof catch (`shit` key). */
function ShitCircleIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={className} fill="none">
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeDasharray="2.5 2.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Solid circle outline — oof catch. */
function OofCircleIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={className} fill="none">
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="2.25"
      />
    </svg>
  );
}

/** Filled triangle — good catch. */
function GoodTriangleIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={className} fill="currentColor">
      <path d="M12 4.5L20 19.5H4L12 4.5Z" />
    </svg>
  );
}

/** Filled diamond — great catch. */
function GreatDiamondIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={className} fill="currentColor">
      <path d="M12 2.5L21.5 12L12 21.5L2.5 12L12 2.5Z" />
    </svg>
  );
}

/** Filled pentagon — cracked catch. */
function CrackedPentagonIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg {...iconBase} className={className} fill="currentColor">
      <path d="M12 2.5L21 9.1L17.5 20.5H6.5L3 9.1L12 2.5Z" />
    </svg>
  );
}

/** Prismatic hexagon — god catch. */
function GodHexagonIcon({
  className = "h-3.5 w-3.5",
  gradientId = "catch-tier-god-fill",
}: IconProps) {
  return (
    <svg {...iconBase} className={className}>
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
      <path
        d="M12 2.5L20.5 7.25V16.75L12 21.5L3.5 16.75V7.25L12 2.5Z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}

const CATCH_TIER_ICON: Record<
  CatchTier,
  (props: IconProps) => ReactNode
> = {
  shit: ShitCircleIcon,
  oof: OofCircleIcon,
  good: GoodTriangleIcon,
  great: GreatDiamondIcon,
  cracked: CrackedPentagonIcon,
  god: GodHexagonIcon,
};

/**
 * Shape glyph for a catch tier — circle → triangle → diamond → pentagon →
 * hexagon as the ladder climbs. Colors ride `currentColor` from a parent tone
 * class (god uses its own prismatic fill). Hover tip matches {@link BondHeart}.
 */
export function CatchTierIcon({
  tier,
  score = null,
  className = "h-3.5 w-3.5",
}: {
  tier: CatchTier;
  /** Rounded weighted score for the tip (optional). */
  score?: number | null;
  className?: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const tipId = useId();
  const tip = catchTierTip(tier, score);
  const label = catchTierLabel(tier) ?? "Catch";
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<TipPos | null>(null);

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

  const Icon = CATCH_TIER_ICON[tier];

  return (
    <span
      ref={wrapRef}
      aria-describedby={open ? tipId : undefined}
      aria-label={label}
      role="img"
      className={`inline-flex cursor-help ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <Icon
        className="h-full w-full"
        gradientId={tier === "god" ? `catch-tier-god-${gradientId}` : undefined}
      />
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
 * Icon + catch label for details / hover.
 * - `inline` — icon left of text (slot cards)
 * - `chip` — bordered row for the details modal
 * - `tile` — icon over text for the hover grade strip
 */
export function CatchTierCaption({
  tier,
  score = null,
  variant = "inline",
  className = "",
  iconClassName,
}: {
  tier: CatchTier;
  /** Rounded weighted score shown in the hover tip. */
  score?: number | null;
  variant?: "inline" | "chip" | "tile";
  className?: string;
  iconClassName?: string;
}) {
  const label = catchTierLabel(tier);
  if (!label) return null;

  const tone = catchTierToneClass(tier);
  const iconSize =
    iconClassName ??
    (variant === "tile" ? "h-4 w-4 shrink-0" : "h-3.5 w-3.5 shrink-0");

  const icon = (
    <CatchTierIcon
      className={`${tone} ${iconSize}`}
      score={score}
      tier={tier}
    />
  );
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
      >
        {icon}
        {text}
      </p>
    );
  }

  return (
    <p
      className={`flex w-full max-w-full items-center justify-center gap-1 ${className}`}
    >
      {icon}
      {text}
    </p>
  );
}
