"use client";

import {
  STAT_KEYS,
  STAT_LABELS,
  type StatKey,
  type StatSpread,
} from "@/lib/stats";

type StatSpreadEditorProps = {
  label: string;
  value: StatSpread;
  max: number;
  onChange: (next: StatSpread) => void;
};

export function StatSpreadEditor({
  label,
  value,
  max,
  onChange,
}: StatSpreadEditorProps) {
  const total = STAT_KEYS.reduce((sum, key) => sum + value[key], 0);

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold tracking-tight text-muted">
          {label}
        </span>
        <span className="font-mono text-[10px] text-muted">
          {total}
          {max === 255 ? " / 510" : ""}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {STAT_KEYS.map((key: StatKey) => (
          <label key={key} className="min-w-0 text-sm">
            <span className="mb-0.5 block text-[10px] font-semibold tracking-tight text-muted">
              {STAT_LABELS[key]}
            </span>
            <input
              type="number"
              min={0}
              max={max}
              className="w-full rounded-lg border border-frame bg-surface px-1.5 py-1 font-mono text-sm tabular-nums"
              value={value[key]}
              onChange={(e) => {
                const n = Number(e.target.value);
                const clamped = Number.isFinite(n)
                  ? Math.min(max, Math.max(0, Math.trunc(n)))
                  : 0;
                onChange({ ...value, [key]: clamped });
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
