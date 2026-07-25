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
    <div className="sm:col-span-2">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="block font-bold text-muted">{label}</span>
        <span className="font-mono text-xs text-muted">
          Total {total}
          {max === 255 ? " / 510" : ""}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STAT_KEYS.map((key: StatKey) => (
          <label key={key} className="text-sm">
            <span className="mb-1 block text-xs font-bold text-muted">
              {STAT_LABELS[key]}
            </span>
            <input
              type="number"
              min={0}
              max={max}
              className="w-full rounded-lg border border-frame bg-surface px-2 py-1.5 font-mono text-sm"
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
