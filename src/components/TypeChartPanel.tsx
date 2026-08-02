"use client";

import { useState } from "react";
import { contrastInkForHex } from "@/lib/pokemon-types";
import {
  formatMultiplier,
  TYPE_COLORS,
  typeMultiplier,
  TYPES,
  type PokemonType,
} from "@/lib/type-chart";

const LEGEND: Array<{
  label: string;
  multiplier: 0 | 0.5 | 1 | 2;
  swatch: string;
}> = [
  { label: "Neutral", multiplier: 1, swatch: "·" },
  { label: "Resist", multiplier: 0.5, swatch: "½" },
  { label: "Super", multiplier: 2, swatch: "2" },
  { label: "Immune", multiplier: 0, swatch: "0" },
];

type ChartHover = {
  atk: PokemonType | null;
  def: PokemonType | null;
};

/** Inline type-chart table for the Tools tab. */
export function TypeChartPanel() {
  const [hover, setHover] = useState<ChartHover | null>(null);
  const scanning = hover != null;

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-2" aria-label="Type chart legend">
        {LEGEND.map((item) => (
          <li key={item.label}>
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums ${cellTone(item.multiplier)}`}
            >
              <span className="inline-flex min-w-4 justify-center" aria-hidden>
                {item.swatch}
              </span>
              <span className="font-medium text-current/85">{item.label}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted/80 sm:hidden" aria-hidden>
        Swipe the grid sideways to see every type →
      </p>
      <div className="overflow-x-auto [scrollbar-gutter:stable]">
        <div className="inline-flex min-w-full flex-col gap-1">
          <p className="pl-10 text-center text-[11px] font-semibold tracking-wide text-muted">
            Defender
          </p>
          <div className="flex items-stretch gap-1">
            <p
              className="flex w-6 shrink-0 items-center justify-center text-[11px] font-semibold tracking-wide text-muted"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Attacker
            </p>
            <table
              className="border-collapse text-[11px] leading-none sm:text-xs"
              onMouseLeave={() => setHover(null)}
            >
              <thead>
                <tr>
                  <th className="sticky left-0 z-[1] bg-surface p-0.5" />
                  {TYPES.map((t) => {
                    const active = hover?.def === t;
                    return (
                      <th
                        key={t}
                        className={`p-0.5 font-semibold transition-opacity duration-100 ${
                          scanning && !active ? "opacity-35" : ""
                        }`}
                        title={t}
                        onMouseEnter={() => setHover({ atk: null, def: t })}
                      >
                        <TypePip type={t} short emphasis={active} />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {TYPES.map((atk) => {
                  const rowActive = hover?.atk === atk;
                  return (
                    <tr key={atk}>
                      <th
                        className={`sticky left-0 z-[1] bg-surface p-0.5 text-left font-semibold transition-opacity duration-100 ${
                          scanning && !rowActive ? "opacity-35" : ""
                        }`}
                        onMouseEnter={() => setHover({ atk, def: null })}
                      >
                        <TypePip type={atk} emphasis={rowActive} />
                      </th>
                      {TYPES.map((def) => {
                        const m = typeMultiplier(atk, def);
                        const label = formatMultiplier(m);
                        const colActive = hover?.def === def;
                        const cross = rowActive && colActive;
                        const band = rowActive || colActive;
                        const dimmed = isDimmed(hover, atk, def);

                        return (
                          <td
                            key={def}
                            className={`min-w-7 p-0.5 text-center font-bold tabular-nums transition-[opacity,box-shadow] duration-100 ${cellTone(m)} ${
                              dimmed ? "opacity-30" : ""
                            } ${
                              cross
                                ? "relative z-[1] shadow-[inset_0_0_0_2px_color-mix(in_srgb,var(--ink)_55%,transparent)]"
                                : band
                                  ? "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_22%,transparent)]"
                                  : ""
                            }`}
                            title={`${atk} → ${def}: ${m}×`}
                            onMouseEnter={() => setHover({ atk, def })}
                          >
                            {label || "·"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function isDimmed(
  hover: ChartHover | null,
  atk: PokemonType,
  def: PokemonType,
): boolean {
  if (!hover) return false;
  if (hover.atk && hover.def) return atk !== hover.atk && def !== hover.def;
  if (hover.atk) return atk !== hover.atk;
  if (hover.def) return def !== hover.def;
  return false;
}

function TypePip({
  type,
  short = false,
  emphasis = false,
}: {
  type: PokemonType;
  short?: boolean;
  emphasis?: boolean;
}) {
  const fill = TYPE_COLORS[type];
  return (
    <span
      className={`inline-flex min-w-7 items-center justify-center rounded px-1 py-0.5 font-bold transition-[box-shadow,transform] duration-100 ${
        emphasis
          ? "scale-105 shadow-[0_0_0_2px_color-mix(in_srgb,var(--ink)_45%,transparent)]"
          : ""
      }`}
      style={{ backgroundColor: fill, color: contrastInkForHex(fill) }}
    >
      {short ? type.slice(0, 3) : type}
    </span>
  );
}

function cellTone(m: 0 | 0.5 | 1 | 2): string {
  // Attacker lens: green = hit hard, red = don't, muted = immune wall.
  if (m === 2) return "bg-accent/15 text-accent-deep";
  if (m === 0.5) return "bg-danger/15 text-danger";
  if (m === 0) return "bg-ink/12 text-muted";
  return "bg-surface-2 text-muted/70";
}
