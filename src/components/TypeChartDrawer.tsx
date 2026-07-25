"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  formatMultiplier,
  TYPE_COLORS,
  typeMultiplier,
  TYPES,
  type PokemonType,
} from "@/lib/type-chart";

export function TypeChartDrawer() {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        className="pressable inline-flex w-full items-center justify-center gap-2 rounded-lg border-frame bg-surface px-3.5 py-2 text-sm font-semibold hover:border-interactive/50"
        onClick={() => setOpen(true)}
      >
        <TypeIcon />
        Type chart
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              data-modal-open=""
              className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            >
              <button
                type="button"
                aria-label="Close type chart"
                className="absolute inset-0 cursor-pointer bg-[var(--scrim)] backdrop-blur-[2px]"
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                autoFocus
                className="gba-frame relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden outline-none sm:max-w-4xl sm:rounded-xl"
              >
                <header className="gba-frame-title relative z-[1] flex items-center justify-between gap-3 px-4 py-3">
                  <h2
                    id={titleId}
                    className="text-base font-semibold tracking-tight"
                  >
                    Type chart
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="pressable border-interactive/35 bg-interactive-soft px-2.5 py-1 text-xs font-semibold text-ink"
                  >
                    Close
                  </button>
                </header>
                <div className="relative z-[1] min-h-0 flex-1 overflow-auto p-3 sm:p-4">
                  <p className="mb-3 text-xs text-muted">
                    Attacking type down the left · defending type across the top.
                    Empty = neutral · ½ = resist · 2 = super · 0 = immune.
                  </p>
                  <TypeChartTable />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function TypeChartTable() {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-[10px] leading-none sm:text-[11px]">
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

function TypeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <circle cx="8" cy="10" r="3.25" />
      <circle cx="16" cy="10" r="3.25" />
      <circle cx="12" cy="16" r="3.25" />
    </svg>
  );
}
