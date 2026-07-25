"use client";

import {
  formatMultiplier,
  TYPE_COLORS,
  typeMultiplier,
  TYPES,
  type PokemonType,
} from "@/lib/type-chart";

/** Inline type-chart table for the Tools tab. */
export function TypeChartPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Attacking type down the left · defending type across the top. Empty =
        neutral · ½ = resist · 2 = super · 0 = immune.
      </p>
      <p className="text-[11px] text-muted/80 sm:hidden" aria-hidden>
        Swipe the grid sideways to see every type →
      </p>
      <div className="overflow-x-auto [scrollbar-gutter:stable]">
        <table className="border-collapse text-[11px] leading-none sm:text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-[1] bg-surface p-0.5" />
              {TYPES.map((t) => (
                <th key={t} className="p-0.5 font-semibold" title={t}>
                  <TypePip type={t} short />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TYPES.map((atk) => (
              <tr key={atk}>
                <th className="sticky left-0 z-[1] bg-surface p-0.5 text-left font-semibold">
                  <TypePip type={atk} />
                </th>
                {TYPES.map((def) => {
                  const m = typeMultiplier(atk, def);
                  const label = formatMultiplier(m);
                  return (
                    <td
                      key={def}
                      className={`min-w-7 p-0.5 text-center font-bold tabular-nums ${cellTone(m)}`}
                      title={`${atk} → ${def}: ${m}×`}
                    >
                      {label || "·"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TypePip({
  type,
  short = false,
}: {
  type: PokemonType;
  short?: boolean;
}) {
  return (
    <span
      className="inline-flex min-w-7 items-center justify-center rounded px-1 py-0.5 font-bold text-white"
      style={{ backgroundColor: TYPE_COLORS[type] }}
    >
      {short ? type.slice(0, 3) : type}
    </span>
  );
}

function cellTone(m: 0 | 0.5 | 1 | 2): string {
  if (m === 0) return "bg-ink/10 text-muted";
  if (m === 0.5) return "bg-interactive/15 text-interactive";
  if (m === 2) return "bg-danger/15 text-danger";
  return "text-muted/50";
}
