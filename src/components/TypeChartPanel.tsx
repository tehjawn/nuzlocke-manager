"use client";

import {
  formatMultiplier,
  TYPE_COLORS,
  typeMultiplier,
  TYPES,
  type PokemonType,
} from "@/lib/type-chart";

const LEGEND: Array<{
  text: string;
  multiplier: 0 | 0.5 | 1 | 2;
  swatch: string;
}> = [
  { text: "Empty = neutral", multiplier: 1, swatch: "·" },
  { text: "½ = resist", multiplier: 0.5, swatch: "½" },
  { text: "2 = super", multiplier: 2, swatch: "2" },
  { text: "0 = immune", multiplier: 0, swatch: "0" },
];

/** Inline type-chart table for the Tools tab. */
export function TypeChartPanel() {
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-2" aria-label="Type chart legend">
        {LEGEND.map((item) => (
          <li key={item.text}>
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums ${cellTone(item.multiplier)}`}
            >
              <span className="inline-flex min-w-4 justify-center" aria-hidden>
                {item.swatch}
              </span>
              <span className="font-medium text-current/85">{item.text}</span>
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
  return "bg-surface-2 text-muted/70";
}
