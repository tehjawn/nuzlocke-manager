"use client";

import { useId } from "react";

type RaySpec = {
  /** Direction from center, degrees (0 = east). */
  angle: number;
  /** Half-width of the far tip in viewBox units. */
  width: number;
  /** Length of the beam from near-core to tip. */
  length: number;
  opacity: number;
  /** Fill — white for most, pastel for accents. */
  color: string;
};

/**
 * Soft white-dominant starburst with sparse rainbow accents.
 * Inspired by https://codepen.io/redrum8/pen/RwOqwJG (SVG ray field),
 * adapted for a small sprite well — luxury prism, not beach-ball conic.
 */
const RAYS: RaySpec[] = [
  // Soft white backbone
  { angle: 8, width: 1.1, length: 92, opacity: 0.62, color: "#ffffff" },
  { angle: 28, width: 0.7, length: 78, opacity: 0.34, color: "#fff8f0" },
  { angle: 46, width: 1.4, length: 88, opacity: 0.52, color: "#ffffff" },
  { angle: 72, width: 0.55, length: 70, opacity: 0.28, color: "#ffffff" },
  { angle: 95, width: 1.2, length: 90, opacity: 0.55, color: "#fffaf5" },
  { angle: 118, width: 0.8, length: 74, opacity: 0.32, color: "#ffffff" },
  { angle: 140, width: 1.5, length: 86, opacity: 0.48, color: "#ffffff" },
  { angle: 162, width: 0.6, length: 68, opacity: 0.26, color: "#fff5ee" },
  { angle: 185, width: 1.3, length: 91, opacity: 0.58, color: "#ffffff" },
  { angle: 208, width: 0.75, length: 76, opacity: 0.32, color: "#ffffff" },
  { angle: 230, width: 1.1, length: 84, opacity: 0.46, color: "#fffaf8" },
  { angle: 252, width: 0.5, length: 66, opacity: 0.24, color: "#ffffff" },
  { angle: 275, width: 1.35, length: 89, opacity: 0.54, color: "#ffffff" },
  { angle: 298, width: 0.7, length: 72, opacity: 0.3, color: "#fff8f2" },
  { angle: 318, width: 1.2, length: 87, opacity: 0.5, color: "#ffffff" },
  { angle: 340, width: 0.65, length: 71, opacity: 0.3, color: "#ffffff" },
  // Sparse rainbow accents (~1 in 4)
  { angle: 18, width: 1.0, length: 80, opacity: 0.42, color: "#ff9a9a" },
  { angle: 58, width: 0.9, length: 82, opacity: 0.4, color: "#ffd090" },
  { angle: 108, width: 1.05, length: 79, opacity: 0.38, color: "#9aefb0" },
  { angle: 168, width: 0.95, length: 83, opacity: 0.4, color: "#8ad4ff" },
  { angle: 218, width: 1.0, length: 81, opacity: 0.38, color: "#c9b0ff" },
  { angle: 288, width: 0.9, length: 77, opacity: 0.38, color: "#ffa8d0" },
];

const CX = 100;
const CY = 100;
/** Keep a small clear core so rays don't pierce the sprite face. */
const NEAR = 10;

function rayPoints(angleDeg: number, width: number, length: number): string {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const px = CX + cos * NEAR;
  const py = CY + sin * NEAR;
  const bx = CX + cos * length;
  const by = CY + sin * length;
  const nx = -sin;
  const ny = cos;
  return `${px},${py} ${bx + nx * width},${by + ny * width} ${bx - nx * width},${by - ny * width}`;
}

type GodPrismRaysProps = {
  className?: string;
};

/**
 * Absolute-fill SVG starburst for god-tier sprite wells.
 * Parent should be `position: relative; overflow: hidden`.
 */
export function GodPrismRays({ className = "" }: GodPrismRaysProps) {
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      aria-hidden
      className={`pokemon-god-rays ${className}`.trim()}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={`god-ray-core-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff8e8" stopOpacity="0.55" />
          <stop offset="35%" stopColor="#ffe0b0" stopOpacity="0.18" />
          <stop offset="70%" stopColor="#c9b0ff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} fill={`url(#god-ray-core-${uid})`} r="48" />
      {RAYS.map((ray, i) => (
        <polygon
          key={`${ray.angle}-${ray.color}-${i}`}
          fill={ray.color}
          opacity={ray.opacity}
          points={rayPoints(ray.angle, ray.width, ray.length)}
        />
      ))}
    </svg>
  );
}
