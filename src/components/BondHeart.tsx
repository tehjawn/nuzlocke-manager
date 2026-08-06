import type { CSSProperties } from "react";

type BondHeartProps = {
  /** 0–1 fill fraction (growing ≈ 0.4, trained ≈ 0.85, bonded = 1). */
  fill: number;
  className?: string;
  /** Accessible name — color alone is not the only signal. */
  label: string;
};

/**
 * Outline heart that fills from the bottom as training / bond progresses.
 * Tint comes from `.pokemon-bond-heart--*` (good → great → cracked family).
 */
export function BondHeart({
  fill,
  className = "h-3.5 w-3.5",
  label,
}: BondHeartProps) {
  const clamped = Math.max(0, Math.min(1, fill));
  const style = { "--bond-fill": `${clamped * 100}%` } as CSSProperties;
  return (
    <span
      aria-label={label}
      className={`pokemon-bond-heart ${className}`}
      style={style}
      title={label}
    >
      <svg
        aria-hidden
        className="pokemon-bond-heart__svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          className="pokemon-bond-heart__outline"
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          strokeLinejoin="round"
        />
        <path
          className="pokemon-bond-heart__fill"
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      </svg>
    </span>
  );
}
