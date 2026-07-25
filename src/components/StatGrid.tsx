import { STAT_KEYS, STAT_LABELS, type StatSpread } from "@/lib/stats";

type StatGridProps = {
  spread: StatSpread;
  tone?: "neutral" | "iv" | "ev";
  /** Tighter chips for board preview cards. */
  compact?: boolean;
};

export function StatGrid({
  spread,
  tone = "neutral",
  compact = false,
}: StatGridProps) {
  const toneClass =
    tone === "iv"
      ? "border-interactive/25 bg-iv"
      : tone === "ev"
        ? "border-accent-2/30 bg-ev"
        : "border-frame/40 bg-surface-2";

  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 sm:gap-2">
      {STAT_KEYS.map((key) => (
        <div
          key={key}
          className={`rounded-lg border text-center ${toneClass} ${
            compact ? "px-1.5 py-1" : "px-2 py-1.5"
          }`}
        >
          <p
            className={`font-semibold tracking-tight text-muted ${
              compact ? "text-[10px]" : "text-[11px]"
            }`}
          >
            {STAT_LABELS[key]}
          </p>
          <p
            className={`font-mono font-bold ${
              compact ? "text-xs" : "text-sm"
            }`}
          >
            {spread[key]}
          </p>
        </div>
      ))}
    </div>
  );
}
